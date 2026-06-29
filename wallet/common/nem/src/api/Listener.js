import { TransactionGroup } from '../constants';
import { ApiError } from 'wallet-common-core';

/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */

/** STOMP protocol frame commands exchanged with NEM NIS over the SockJS transport. */
const StompCommand = {
	CONNECT: 'CONNECT',
	CONNECTED: 'CONNECTED',
	SUBSCRIBE: 'SUBSCRIBE',
	SEND: 'SEND',
	MESSAGE: 'MESSAGE'
};

/** STOMP frame header names used when sending and parsing frames. */
const StompHeader = {
	ID: 'id',
	DESTINATION: 'destination',
	ACCEPT_VERSION: 'accept-version',
	HEART_BEAT: 'heart-beat'
};

/** SockJS transport frame type prefixes: open, heartbeat, message array, close. */
const SockJsFrameType = {
	OPEN: 'o',
	HEARTBEAT: 'h',
	MESSAGE: 'a',
	CLOSE: 'c'
};

/**
 * NEM NIS STOMP destinations. BLOCK, ERRORS and ACCOUNT_SUBSCRIBE are complete destinations,
 * while CONFIRMED_TRANSACTIONS and UNCONFIRMED_TRANSACTIONS are prefixes that are suffixed
 * with `/{accountAddress}` to scope the subscription to a single account.
 */
const StompDestination = {
	BLOCK: '/blocks/new',
	ERRORS: '/errors',
	ACCOUNT_SUBSCRIBE: '/w/api/account/subscribe',
	CONFIRMED_TRANSACTIONS: '/transactions',
	UNCONFIRMED_TRANSACTIONS: '/unconfirmed'
};

/** A STOMP frame is terminated by a single NULL byte. */
const STOMP_TERMINATOR = String.fromCharCode(0);

/** Supported STOMP protocol versions advertised in the CONNECT frame. */
const STOMP_ACCEPT_VERSION = '1.1,1.0';

/** Heart-beat negotiation (`cx,cy`) advertised in the CONNECT frame: disabled in both directions. */
const STOMP_HEART_BEAT = '0,0';

export class Listener {
	/**
	 * Constructor Listener.
	 * @param {NetworkProperties} networkProperties - The network properties.
	 * @param {string} accountAddress - The account address to listen for transactions.
	 * @param {Function} [websocketInjected] - Optional WebSocket constructor override (for testing).
	 */
	constructor(networkProperties, accountAddress, websocketInjected) {
		this.networkProperties = networkProperties;
		this.accountAddress = accountAddress;
		this.url = networkProperties.wsUrl;
		this.websocketInjected = websocketInjected;
		this.webSocket = null;
		this.handlers = {};
		this.subscriptionCount = 0;
		this.uid = '';
		this.SIGINT = false;
		this.resolveConnect = null;
	}

	/**
	 * Opens the WebSocket connection and completes the SockJS + STOMP handshake.
	 * @param {function({ client: string, code: number, reason: string }): void} [onUnsolicitedCloseCallback] - Called on unexpected close.
	 * @returns {Promise<void>} Resolves once the STOMP session is connected.
	 */
	open(onUnsolicitedCloseCallback) {
		return new Promise((resolve, reject) => {
			if (this.webSocket && this.webSocket.readyState !== WebSocket.CLOSED) {
				resolve();
				return;
			}

			const WebSocketImpl = this.websocketInjected || WebSocket;
			this.webSocket = new WebSocketImpl(this._createSessionUrl());
			this.resolveConnect = resolve;

			this.webSocket.onopen = () => {};
			this.webSocket.onerror = () => reject(new ApiError('Failed to open NEM listener WebSocket connection'));
			this.webSocket.onclose = event => {
				if (this.SIGINT)
					return;

				const closeEvent = { client: this.uid, code: event.code, reason: event.reason };
				onUnsolicitedCloseCallback ? onUnsolicitedCloseCallback(closeEvent) : reject(closeEvent);
			};
			this.webSocket.onmessage = message => this._handleSockJsFrame(String(message.data));
		});
	}

	/**
	 * Closes the WebSocket connection.
	 * @returns {void}
	 */
	close() {
		if (this.webSocket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(this.webSocket.readyState)) {
			this.SIGINT = true;
			this.webSocket.close();
		}
	}

	/**
	 * Subscribes to new blocks.
	 * @param {function({ height: number }): void} callback - The callback function.
	 * @returns {void}
	 */
	listenNewBlock(callback) {
		this._subscribe(StompDestination.BLOCK, callback);
	}

	/**
	 * Subscribes to newly added transactions for the account. NEM NIS only exposes confirmed and
	 * unconfirmed channels, so any other group (e.g. Partial) is silently ignored rather than throwing,
	 * keeping the shared NetworkManager subscribe loop from breaking on an unsupported group.
	 * @param {'confirmed' | 'unconfirmed'} group - The transaction group.
	 * @param {function({ hash: string }): void} callback - The callback function.
	 * @returns {void}
	 */
	listenAddedTransactions(group, callback) {
		const destinationPrefix = {
			[TransactionGroup.CONFIRMED]: StompDestination.CONFIRMED_TRANSACTIONS,
			[TransactionGroup.UNCONFIRMED]: StompDestination.UNCONFIRMED_TRANSACTIONS
		}[group];

		if (!destinationPrefix)
			return;

		this._subscribe(
			`${destinationPrefix}/${this.accountAddress}`,
			callback,
			transaction => ({ hash: transaction?.meta?.hash?.data ?? null })
		);
	}

	/**
	 * Subscribes to transaction validation errors for the account.
	 * @param {function(object): void} callback - The callback function.
	 * @returns {void}
	 */
	listenTransactionError(callback) {
		this._subscribe(StompDestination.ERRORS, callback);
	}

	/**
	 * Builds the per-connection SockJS WebSocket URL. SockJS requires a
	 * `{base}/{server}/{session}/websocket` path; a fresh random server and session id pair is
	 * generated for every connection so reconnects do not reuse a stale transport session.
	 * @returns {string} The fully-qualified SockJS WebSocket URL.
	 */
	_createSessionUrl() {
		const serverId = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
		const sessionId = Math.random().toString(36).slice(2, 10);

		return `${this.url}/${serverId}/${sessionId}/websocket`;
	}

	/**
	 * Builds a STOMP frame and sends it wrapped in the SockJS message framing. A STOMP frame is
	 * `COMMAND\nheader:value...\n\nbody` terminated by a NULL byte, and SockJS expects each outgoing
	 * message to be a JSON array containing that single frame string.
	 * @param {string} command - The STOMP command (e.g. CONNECT, SUBSCRIBE, SEND).
	 * @param {Object<string, string>} headers - The STOMP frame headers.
	 * @param {string} [body] - The STOMP frame body.
	 * @returns {void}
	 */
	_sendStompFrame(command, headers, body = '') {
		const headerLines = Object.entries(headers).map(([key, value]) => `${key}:${value}`).join('\n');
		const frame = `${command}\n${headerLines}\n\n${body}${STOMP_TERMINATOR}`;

		this.webSocket?.send(JSON.stringify([frame]));
	}

	/**
	 * Registers a handler for a destination and sends the STOMP SUBSCRIBE frame for it. Each
	 * subscription is assigned a unique incrementing id so NIS can distinguish concurrent subscriptions.
	 * @param {string} destination - The STOMP destination to subscribe to.
	 * @param {function(object): void} callback - Invoked with the (optionally mapped) payload of each message.
	 * @param {function(object): object} [mapPayload] - Maps the raw frame body before it reaches the callback.
	 * @returns {void}
	 */
	_subscribe(destination, callback, mapPayload) {
		this.subscriptionCount += 1;
		this.handlers[destination] = { callback, mapPayload };
		this._sendStompFrame(StompCommand.SUBSCRIBE, {
			[StompHeader.ID]: `sub-${this.subscriptionCount}`,
			[StompHeader.DESTINATION]: destination
		});
	}

	/**
	 * Handles a raw SockJS transport frame. The leading character identifies the frame type: an open
	 * frame triggers the STOMP CONNECT handshake and a message frame carries a JSON array of STOMP
	 * frames, while heartbeat and close frames are ignored.
	 * @param {string} data - The raw SockJS frame text.
	 * @returns {void}
	 */
	_handleSockJsFrame(data) {
		if (data === SockJsFrameType.OPEN) {
			this._sendStompFrame(StompCommand.CONNECT, {
				[StompHeader.ACCEPT_VERSION]: STOMP_ACCEPT_VERSION,
				[StompHeader.HEART_BEAT]: STOMP_HEART_BEAT
			});
			return;
		}

		if (!data.startsWith(SockJsFrameType.MESSAGE))
			return;

		let stompFrames;
		try {
			stompFrames = JSON.parse(data.slice(1));
		} catch {
			return;
		}

		stompFrames.forEach(frame => this._handleStompFrame(frame));
	}

	/**
	 * Handles a single decoded STOMP frame. On CONNECTED it completes the handshake by subscribing the
	 * account (NIS only pushes account-scoped transactions after this request) and resolves the open()
	 * promise; on MESSAGE it routes the parsed body to the handler registered for the frame's
	 * destination. Any other command is ignored.
	 * @param {string} frame - The decoded STOMP frame.
	 * @returns {void}
	 */
	_handleStompFrame(frame) {
		const [command] = frame.split('\n', 1);

		if (command === StompCommand.CONNECTED) {
			this.uid = `${Date.now()}`;
			this._sendStompFrame(
				StompCommand.SEND,
				{ [StompHeader.DESTINATION]: StompDestination.ACCOUNT_SUBSCRIBE },
				JSON.stringify({ account: this.accountAddress })
			);
			this.resolveConnect?.();
			this.resolveConnect = null;
			return;
		}

		if (command !== StompCommand.MESSAGE)
			return;

		const headerEnd = frame.indexOf('\n\n');
		const destination = frame
			.slice(0, headerEnd)
			.split('\n')
			.map(line => line.split(':'))
			.find(([key]) => key === StompHeader.DESTINATION)?.[1];
		const handler = this.handlers[destination];

		if (!handler)
			return;

		const payload = this._parseFrameBody(frame.slice(headerEnd + 2));
		handler.callback(handler.mapPayload ? handler.mapPayload(payload) : payload);
	}

	/**
	 * Strips the trailing STOMP NULL terminator and parses the frame body as JSON. Falls back to the
	 * trimmed raw string when the body is not valid JSON, and returns null for an empty body.
	 * @param {string} rawBody - The raw STOMP frame body.
	 * @returns {object|string|null} The parsed payload.
	 */
	_parseFrameBody(rawBody) {
		const trimmed = (rawBody.endsWith(STOMP_TERMINATOR) ? rawBody.slice(0, -1) : rawBody).trim();

		try {
			return trimmed ? JSON.parse(trimmed) : null;
		} catch {
			return trimmed;
		}
	}
}
