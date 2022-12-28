
import { Address, RepositoryFactoryHttp} from 'symbol-sdk';

export class ListenerService {
    static async listen(
        networkProperties, 
        address,
        {
            onConfirmedAdd,
            onUnconfirmedAdd, 
            onUnconfirmedRemove, 
            onAggregateBondedAdd, 
            onAggregateBondedRemove,
            onTransactionError
        }
    ) {
        const repositoryFactory = new RepositoryFactoryHttp(networkProperties.nodeUrl, {
            websocketInjected: WebSocket,
        });
        const listener = repositoryFactory.createListener();
        await listener.open();
          
        const sdkAddress = Address.createFromRawAddress(address);

        listener.confirmed(sdkAddress).subscribe(onConfirmedAdd);
        listener.unconfirmedAdded(sdkAddress).subscribe(onUnconfirmedAdd);
        listener.unconfirmedRemoved(sdkAddress).subscribe(onUnconfirmedRemove);
        listener.aggregateBondedAdded(sdkAddress).subscribe(onAggregateBondedAdd);
        listener.aggregateBondedRemoved(sdkAddress).subscribe(onAggregateBondedRemove);
        listener.status(sdkAddress).subscribe(onTransactionError);

        return listener;
    }

    // static create(networkProperties, address, onMessage, onError, onClose, onOpen) {
    //     console.log('Listener try to connect to', networkProperties.wsUrl)
    //     const ws = new WebSocket(networkProperties.wsUrl);
    //     ws.onopen = onOpen;
    //     ws.onclose = onClose;
    //     ws.onerror = onError;
    //     ws.onmessage = (message) => onMessage(ListenerService.handleMessage(ws, message, address));

    //     return ws;
    // }

    // static handleMessage(ws, rawMessage) {
    //     let message = '';
        
    //     try {
    //         message = JSON.parse(rawMessage.data);
    //     }
    //     catch {
    //         return;
    //     }

    //     const { topic, uid } = message;

    //     if (uid) {
    //         ListenerService.subscribeTo(ws, uid, 'confirmedAdded');
    //         ListenerService.subscribeTo(ws, uid, 'unconfirmedAdded');
    //         ListenerService.subscribeTo(ws, uid, 'unconfirmedRemoved');
    //         ListenerService.subscribeTo(ws, uid, 'partialAdded');
    //         ListenerService.subscribeTo(ws, uid, 'partialRemoved');
    //         ListenerService.subscribeTo(ws, uid, 'cosignature');
    //     }

    //     if (topic) {
    //         const channelName = topic.indexOf('/') >= 0 ? topic.substr(0, topic.indexOf('/')) : topic;
    //         const channelParam = topic.indexOf('/') >= 0 ? topic.split('/')[1] : '';

    //         console.log({channelName, channelParam})
    //     }
    // }

    // static subscribeTo(ws, uid, channel) {
    //     console.warn('Subscribe to', uid, channel)
    //     const subscriptionMessage = {
    //         uid,
    //         subscribe: channel,
    //     };
    //     ws.send(JSON.stringify(subscriptionMessage));
    // }
};
