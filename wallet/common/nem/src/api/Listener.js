import { TransactionGroup } from '../constants';
import { ApiError } from 'wallet-common-core';

/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */

const ListenerChannelName = {
	BLOCK: 'block',
	CONFIRMED_ADDED: 'confirmedAdded',
	UNCONFIRMED_ADDED: 'unconfirmedAdded',
	UNCONFIRMED_REMOVED: 'unconfirmedRemoved',
	STATUS: 'status'
};

export class Listener {
	/**
	 * @param {NetworkProperties} networkProperties
	 * @param {string} accountAddress
	 * @param {Function} [websocketInjected] - Optional WebSocket constructor override for testing.
	 */
	constructor(networkProperties, accountAddress, websocketInjected) {
		this.networkProperties = networkProperties;
		this.accountAddress = accountAddress;
		this.url = networkProperties.wsUrl;
		this.websocketInjected = websocketInjected;
		this.webSocket = null;
		this.handlers = {};
		this.uid = '';
		this.SIGINT = false;
	}

	/**
	 * Opens the WebSocket connection. Resolves after the server uid handshake.
	 * @param {Function} [onUnsolicitedCloseCallback] - Called when the connection closes unexpectedly.
	 * @returns {Promise<void>}
	 */
	open(onUnsolicitedCloseCallback) {
		return new Promise((resolve, reject) => {
			if (!this.webSocket || this.webSocket.readyState === WebSocket.CLOSED) {
				const WS = this.websocketInjected || WebSocket;
				this.webSocket = new WS(this.url);
				this._initializeWebSocketHandlers(resolve, reject, onUnsolicitedCloseCallback);
			} else {
				resolve();
			}
		});
	}

	/**
	 * Closes the WebSocket connection.
	 */
	close() {
		if (this.webSocket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(this.webSocket.readyState)) {
			this.SIGINT = true;
			this.webSocket.close();
		}
	}

	/** @private */
	_initializeWebSocketHandlers(resolve, reject, onUnsolicitedCloseCallback) {
		this.webSocket.onopen = () => {};
		this.webSocket.onerror = reject;
		this.webSocket.onclose = event => {
			if (this.SIGINT)
				return;
			const closeEvent = { client: this.uid, code: event.code, reason: event.reason };
			onUnsolicitedCloseCallback ? onUnsolicitedCloseCallback(closeEvent) : reject(closeEvent);
		};
		this.webSocket.onmessage = msg => this._handleMessage(JSON.parse(msg.data), resolve);
	}

	/** @private */
	_handleMessage(message, resolve) {
		// First message from server contains the uid handshake
		if (message.uid) {
			this.uid = message.uid;
			resolve();
			return;
		}

		const [channelName] = message.topic.split('/');

		const handler = this.handlers[channelName];
		if (!handler || typeof handler !== 'function')
			return;

		let payload;

		switch (channelName) {
		case ListenerChannelName.CONFIRMED_ADDED:
		case ListenerChannelName.UNCONFIRMED_ADDED:
		case ListenerChannelName.UNCONFIRMED_REMOVED:
			payload = { hash: message.data?.meta?.hash };
			break;
		case ListenerChannelName.BLOCK:
			payload = message.data;
			break;
		case ListenerChannelName.STATUS:
			payload = message.data;
			break;
		default:
			throw new ApiError(`Channel: ${channelName} is not supported.`);
		}

		handler(payload);
	}

	/**
	 * Subscribe to a channel.
	 * @param {string} channel - The channel to subscribe to.
	 */
	subscribeTo(channel) {
		this.webSocket?.send(JSON.stringify({ uid: this.uid, subscribe: channel }));
	}

	/**
	 * Listens for newly confirmed/unconfirmed transactions.
	 * @param {string} group - TransactionGroup value.
	 * @param {Function} callback
	 */
	listenAddedTransactions(group, callback) {
		const channelMap = {
			[TransactionGroup.CONFIRMED]: ListenerChannelName.CONFIRMED_ADDED,
			[TransactionGroup.UNCONFIRMED]: ListenerChannelName.UNCONFIRMED_ADDED
		};
		const channelName = channelMap[group];
		if (!channelName)
			throw new ApiError(`Failed to subscribe. Transaction group: ${group} is not supported.`);
		this.subscribeTo(`${channelName}/${this.accountAddress}`);
		this.handlers[channelName] = callback;
	}

	/**
	 * Listens for transactions removed from the unconfirmed pool.
	 * @param {string} group
	 * @param {Function} callback
	 */
	listenRemovedTransactions(group, callback) {
		if (group !== TransactionGroup.UNCONFIRMED)
			throw new ApiError(`Failed to subscribe. Transaction group: ${group} is not supported for removal.`);
		const channelName = ListenerChannelName.UNCONFIRMED_REMOVED;
		this.subscribeTo(`${channelName}/${this.accountAddress}`);
		this.handlers[channelName] = callback;
	}

	/**
	 * Listens for new blocks.
	 * @param {Function} callback
	 */
	listenNewBlock(callback) {
		this.subscribeTo(ListenerChannelName.BLOCK);
		this.handlers[ListenerChannelName.BLOCK] = callback;
	}

	/**
	 * Listens for transaction status / error events for this account.
	 * @param {Function} callback
	 */
	listenTransactionError(callback) {
		this.subscribeTo(`${ListenerChannelName.STATUS}/${this.accountAddress}`);
		this.handlers[ListenerChannelName.STATUS] = callback;
	}
}

