import { TransactionGroup } from '../constants';
import { ApiError } from 'wallet-common-core';

/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */

const ListenerChannelName = {
	BLOCK: 'block',
	CONFIRMED_ADDED: 'confirmedAdded',
	UNCONFIRMED_ADDED: 'unconfirmedAdded',
	UNCONFIRMED_REMOVED: 'unconfirmedRemoved',
	PARTIAL_ADDED: 'partialAdded',
	PARTIAL_REMOVED: 'partialRemoved',
	COSIGNATURE: 'cosignature',
	MODIFY_MULTISIG_ACOUNT: 'modifyMultisigAccount',
	STATUS: 'status',
	FINALIZED_BLOCK: 'finalizedBlock'
};

export class Listener {
	/**
     * Constructor Listener
     * @param {NetworkProperties} networkProperties - The network properties.
     * @param {string} accountAddress - The account address to listen for transactions.
     * @param {WebSocket} [websocketInjected] - The injected websocket.
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
     * Open a websocket connection.
     * @param {function({ client: string, code: number, reason: string }): void} [onUnsolicitedCloseCallback] - The callback function.
     * @returns {Promise<void>} - A promise that resolves when the connection is open.
     */
	open(onUnsolicitedCloseCallback) {
		return new Promise((resolve, reject) => {
			if (!this.webSocket || this.webSocket.readyState === WebSocket.CLOSED) {
				this.webSocket = this.websocketInjected ? new this.websocketInjected(this.url) : new WebSocket(this.url);
				this._initializeWebSocketHandlers(resolve, reject, onUnsolicitedCloseCallback);
			} else {
				resolve();
			}
		});
	}

	/**
     * Close the websocket connection.
     */
	close() {
		if (this.webSocket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(this.webSocket.readyState)) {
			this.SIGINT = true;
			this.webSocket.close();
		}
	}

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

	async _handleMessage(message, resolve) {
		if (message.uid) {
			this.uid = message.uid;
			resolve();
			return;
		}
		
		const [channelName, channelParam] = message.topic.split('/');

		// Ignore if no handler registered for this channel
		const handler = this.handlers[channelName];
		if (!handler || typeof handler !== 'function')
			return;

		let payload;

		switch (channelName) {
		case ListenerChannelName.CONFIRMED_ADDED:
		case ListenerChannelName.UNCONFIRMED_ADDED:
		case ListenerChannelName.PARTIAL_ADDED:
			payload = { hash: message.data.meta.hash };
			break;
		case ListenerChannelName.BLOCK:
			payload = message.data;
			break;
		case ListenerChannelName.STATUS:
			payload = {
				type: 'TransactionStatusError',
				rawAddress: channelParam,
				...message.data
			};
			break;
		case ListenerChannelName.COSIGNATURE:
			payload = { type: 'CosignatureSignedTransaction', ...message.data };
			break;
		case ListenerChannelName.PARTIAL_REMOVED:
		case ListenerChannelName.UNCONFIRMED_REMOVED:
			payload = { hash: message.data.meta.hash };
			break;
		case ListenerChannelName.FINALIZED_BLOCK:
			payload = { type: 'FinalizedBlock', ...message.data };
			break;
		default:
			throw new ApiError(`Channel: ${channelName} is not supported.`);
		}

		handler(payload);
	}

	/**
     * Subscribe to a channel.
     * @param {string} channel - The channel to subscribe to.
     * @returns {void}
     */
	subscribeTo(channel) {
		this.webSocket?.send(JSON.stringify({ uid: this.uid, subscribe: channel }));
	}

	/**
     * Subscribe to transactions.
     * @param {'added' | 'removed'} action - The action.
     * @param {'confirmed' | 'unconfirmed' | 'partial'} group - The transaction group.
     * @param {function({ hash: string }): void} callback - The callback function.
     */
	_listenTransactions(action, group, callback) {
		const channel = {
			added: {
				[TransactionGroup.CONFIRMED]: ListenerChannelName.CONFIRMED_ADDED,
				[TransactionGroup.UNCONFIRMED]: ListenerChannelName.UNCONFIRMED_ADDED,
				[TransactionGroup.PARTIAL]: ListenerChannelName.PARTIAL_ADDED
			},
			removed: {
				[TransactionGroup.UNCONFIRMED]: ListenerChannelName.UNCONFIRMED_REMOVED,
				[TransactionGroup.PARTIAL]: ListenerChannelName.PARTIAL_REMOVED
			}
		}[action][group];
		
		if (!channel) 
			throw new ApiError(`Failed to subscribe. Transaction group: ${group} is not supported.`);
        
		this.subscribeTo(`${channel}/${this.accountAddress}`);
		this.handlers[channel] = callback;
	}

	/**
     * Subscribe to new transactions.
     * @param {'confirmed' | 'unconfirmed' | 'partial'} group - The transaction group.
     * @param {function({ hash: string }): void} callback - The callback function.
     */
	listenAddedTransactions(group, callback) {
		this._listenTransactions('added', group, callback);
	}

	/**
     * Subscribe to removed transactions.
     * @param {'unconfirmed' | 'partial'} group - The transaction group.
     * @param {function(string): void} callback - The callback function, that receives the transaction hash.
     */
	listenRemovedTransactions(group, callback) {
		this._listenTransactions('removed', group, callback);
	}

	/**
     * Subscribe to new blocks.
     * @param {function(Object): void} callback - The callback function.
     */
	listenNewBlock(callback) {
		this.subscribeTo(ListenerChannelName.BLOCK);
		this.handlers[ListenerChannelName.BLOCK] = callback;
	}

	/**
     * Subscribe to transaction status errors.
     * @param {function(Object): void} callback - The callback function.
     */
	listenTransactionError(callback) {
		this.subscribeTo(`${ListenerChannelName.STATUS}/${this.accountAddress}`);
		this.handlers[ListenerChannelName.STATUS] = callback;
	}
}
