import { TransactionService } from 'src/services/TransactionService';

const ListenerChannelName = {
    block: 'block',
    confirmedAdded: 'confirmedAdded',
    unconfirmedAdded: 'unconfirmedAdded',
    unconfirmedRemoved: 'unconfirmedRemoved',
    partialAdded: 'partialAdded',
    partialRemoved: 'partialRemoved',
    cosignature: 'cosignature',
    modifyMultisigAccount: 'modifyMultisigAccount',
    status: 'status',
    finalizedBlock: 'finalizedBlock',
}

export class ListenerService {
    constructor(networkProperties, currentAccount) {
        this.networkProperties = networkProperties;
        this.currentAccount = currentAccount;
        this.url = networkProperties.nodeUrl.replace('http', 'ws') + '/ws';
        this.webSocket;
        this.handlers = {};
        this.uid = '';
        this.SIGINT = false;
    }

    open(onUnsolicitedCloseCallback) {
        return new Promise((resolve, reject) => {
            if (this.webSocket === undefined || this.webSocket.readyState === this.webSocket.CLOSED) {
                if (this.websocketInjected) {
                    this.webSocket = new this.websocketInjected(this.url);
                } else {
                    this.webSocket = new WebSocket(this.url);
                }
                this.webSocket.onopen = () => {};
                this.webSocket.onerror = (err) => {
                    reject(err);
                };
                this.webSocket.onclose = (closeEvent) => {
                    if (this.SIGINT) {
                        return;
                    }
                    if (closeEvent) {
                        const event = {
                            client: this.uid,
                            code: closeEvent.code,
                            reason: closeEvent.reason,
                        };
                        if (onUnsolicitedCloseCallback) {
                            onUnsolicitedCloseCallback(event);
                        } else {
                            reject(event);
                        }
                    }
                };
                this.webSocket.onmessage = (msg) => {
                    const message = JSON.parse(msg.data);
                    this.handleMessage(message, resolve);
                };
            } else {
                resolve();
            }
        });
    }

    close() {
        if (
            this.webSocket &&
            (this.webSocket.readyState === this.webSocket.OPEN || this.webSocket.readyState === this.webSocket.CONNECTING)
        ) {
            this.SIGINT = true;
            this.webSocket.close();
        }
    }

    async handleMessage(message, resolve) {
        if (message.uid) {
            this.uid = message.uid;
            resolve();
            return;
        }
        const topic = message.topic;
        const channelName = topic.indexOf('/') >= 0 ? topic.substr(0, topic.indexOf('/')) : topic;
        const channelParam = topic.indexOf('/') >= 0 ? topic.split('/')[1] : '';
        switch (channelName) {
            case ListenerChannelName.confirmedAdded:
            case ListenerChannelName.unconfirmedAdded:
            case ListenerChannelName.partialAdded:
                this.handlers[channelName](await TransactionService.resolveTransactionDTOs(
                    [message.data],
                    this.networkProperties,
                    this.currentAccount
                ));
                break;
            case ListenerChannelName.block:
                this.handlers[channelName](message.data);
                break;
            case ListenerChannelName.status:
                this.handlers[channelName]({
                    type: 'TransactionStatusError',
                    rawAddress: channelParam,
                    hash: message.data.hash,
                    code: message.data.code,
                    deadline: message.data.deadline,
                });
                break;
            case ListenerChannelName.cosignature:
                this.handlers[channelName]({
                    type: 'CosignatureSignedTransaction',
                    parentHash: message.data.parentHash,
                    signature: message.data.signature,
                    signerPublicKey: message.data.signerPublicKey,
                });
                break;
            case ListenerChannelName.partialRemoved:
            case ListenerChannelName.unconfirmedRemoved:
                this.handlers[channelName](message.data.meta.hash);
                break;
            case ListenerChannelName.finalizedBlock:
                this.handlers[channelName]({
                    type: 'FinalizedBlock',
                    height: message.data.height,
                    hash: message.data.hash,
                    finalizationPoint: message.data.finalizationPoint,
                    finalizationEpoch: message.data.finalizationEpoch,
                });
                break;
            default:
                throw new Error(`Channel: ${channelName} is not supported.`);
        }
    }

    subscribeTo(channel) {
        const subscriptionMessage = {
            uid: this.uid,
            subscribe: channel,
        };
        this.webSocket.send(JSON.stringify(subscriptionMessage));
    }

    listenTransactions(callback, group = 'confirmed') {
        const channelMap = {
            confirmed: ListenerChannelName.confirmedAdded,
            unconfirmed: ListenerChannelName.unconfirmedAdded,
            partial: ListenerChannelName.partialAdded
        };
        const channel = channelMap[group];
        this.subscribeTo(`${channel}/${this.currentAccount.address}`);
        this.handlers[channel] = callback;
    }

    listenNewBlock(callback) {
        this.subscribeTo(ListenerChannelName.block);
        this.handlers[ListenerChannelName.block] = callback;
    }

    listenTransactionError(callback) {
        const channel = ListenerChannelName.status;
        this.subscribeTo(`${channel}/${this.currentAccount.address}`);
        this.handlers[channel] = callback;
    }
}
