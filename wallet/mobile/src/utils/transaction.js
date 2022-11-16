import { TransactionType } from 'symbol-sdk';

export const isAggregateTransaction = transaction => {
    return transaction.type === TransactionType.AGGREGATE_BONDED
        || transaction.type === TransactionType.AGGREGATE_COMPLETE;
}

export const getGroupFromtransaction = transaction => {
    if (transaction.isConfirmed())
        return 'confirmed';
    if (transaction.isUnconfirmed())
        return 'unconfirmed';
    return 'partial';
};
