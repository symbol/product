import { TransactionGroup } from '@/app/constants';
import { TransactionService } from '@/app/lib/services/TransactionService';
import * as AccountTypes from '@/app/types/Account';
import * as NetworkTypes from '@/app/types/Network';
import * as TransactionTypes from '@/app/types/Transaction';

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
    FINALIZED_BLOCK: 'finalizedBlock',
};

export class ListenerService {
    /**
     * Constructor ListenerService
     * @param {NetworkTypes.NetworkProperties} networkProperties - The network properties.
     * @param {AccountTypes.PublicAccount} account - The account.
     * @param {WebSocket} [websocketInjected] - The injected websocket.
     */
    constructor(networkProperties, account, websocketInjected) {
        this.networkProperties = networkProperties;
        this.account = account;
        this.url = networkProperties.wsUrl;
        this.websocketInjected = websocketInjected;
        this.webSocket = null;
        this.handlers = {};
        this.uid = '';
        this.SIGINT = false;
    }

    /**
     * Open a websocket connection.
     * @param {(event: { client: string, code: number, reason: string }) => void} [onUnsolicitedCloseCallback] - The callback function.
     * @returns {Promise<void>}
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
     * @returns {void}
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
        this.webSocket.onclose = (event) => {
            if (this.SIGINT) return;
            const closeEvent = { client: this.uid, code: event.code, reason: event.reason };
            onUnsolicitedCloseCallback ? onUnsolicitedCloseCallback(closeEvent) : reject(closeEvent);
        };
        this.webSocket.onmessage = (msg) => this._handleMessage(JSON.parse(msg.data), resolve);
    }

    async _handleMessage(message, resolve) {
        if (message.uid) {
            this.uid = message.uid;
            resolve();
            return;
        }
        const [channelName, channelParam] = message.topic.split('/');

        if (!this.handlers[channelName]) return;

        switch (channelName) {
            case ListenerChannelName.CONFIRMED_ADDED:
            case ListenerChannelName.UNCONFIRMED_ADDED:
            case ListenerChannelName.PARTIAL_ADDED:
                const transactions = await TransactionService.resolveTransactionDTOs([message.data], this.networkProperties, this.account);
                this.handlers[channelName](transactions[0]);
                break;
            case ListenerChannelName.BLOCK:
                this.handlers[channelName](message.data);
                break;
            case ListenerChannelName.STATUS:
                this.handlers[channelName]({
                    type: 'TransactionStatusError',
                    rawAddress: channelParam,
                    ...message.data,
                });
                break;
            case ListenerChannelName.COSIGNATURE:
                this.handlers[channelName]({ type: 'CosignatureSignedTransaction', ...message.data });
                break;
            case ListenerChannelName.PARTIAL_REMOVED:
            case ListenerChannelName.UNCONFIRMED_REMOVED:
                this.handlers[channelName](message.data.meta.hash);
                break;
            case ListenerChannelName.FINALIZED_BLOCK:
                this.handlers[channelName]({ type: 'FinalizedBlock', ...message.data });
                break;
            default:
                throw new Error(`Channel: ${channelName} is not supported.`);
        }
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
     * @param {(transaction: TransactionTypes.Transaction) => void} callback - The callback function.
     */
    _listenTransactions(action, group, callback) {
        const channel = {
            added: {
                [TransactionGroup.CONFIRMED]: ListenerChannelName.CONFIRMED_ADDED,
                [TransactionGroup.UNCONFIRMED]: ListenerChannelName.UNCONFIRMED_ADDED,
                [TransactionGroup.PARTIAL]: ListenerChannelName.PARTIAL_ADDED,
            },
            removed: {
                [TransactionGroup.UNCONFIRMED]: ListenerChannelName.UNCONFIRMED_REMOVED,
                [TransactionGroup.PARTIAL]: ListenerChannelName.PARTIAL_REMOVED,
            },
        }[action][group];
        if (!channel) {
            throw new Error(`Failed to subscribe. Transaction group: ${group} is not supported.`);
        }

        this.subscribeTo(`${channel}/${this.account.address}`);
        this.handlers[channel] = callback;
    }

    /**
     * Subscribe to new transactions.
     * @param {'confirmed' | 'unconfirmed' | 'partial'} group - The transaction group.
     * @param {(transaction: TransactionTypes.Transaction) => void} callback - The callback function.
     */
    listenAddedTransactions(group, callback) {
        this._listenTransactions('added', group, callback);
    }

    /**
     * Subscribe to removed transactions.
     * @param {'unconfirmed' | 'partial'} group - The transaction group.
     * @param {(hash: string) => void} callback - The callback function.
     */
    listenRemovedTransactions(group, callback) {
        this._listenTransactions('removed', group, callback);
    }

    /**
     * Subscribe to new blocks.
     * @param {(block: Object) => void} callback - The callback function.
     */
    listenNewBlock(callback) {
        this.subscribeTo(ListenerChannelName.BLOCK);
        this.handlers[ListenerChannelName.BLOCK] = callback;
    }

    /**
     * Subscribe to transaction status errors.
     * @param {(error: Object) => void} callback - The callback function.
     */
    listenTransactionError(callback) {
        this.subscribeTo(`${ListenerChannelName.STATUS}/${this.account.address}`);
        this.handlers[ListenerChannelName.STATUS] = callback;
    }
}
