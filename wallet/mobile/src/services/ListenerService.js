import { Address, RepositoryFactoryHttp } from 'symbol-sdk';

export class ListenerService {
    static async listen(
        networkProperties,
        address,
        { onConfirmedAdd, onUnconfirmedAdd, onUnconfirmedRemove, onAggregateBondedAdd, onAggregateBondedRemove, onTransactionError }
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
}
