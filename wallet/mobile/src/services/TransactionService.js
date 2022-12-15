import { isAggregateTransaction, transactionFromDTO } from 'src/utils';
import _ from 'lodash';
import { Address, Order, TransactionHttp, } from 'symbol-sdk';
export class TransactionService {
    static async fetchAccountTransactions(account, networkProperties, { 
        pageNumber = 1, 
        pageSize = 15, 
        group = 'confirmed', 
        filter = {}, 
    }) {
        const transactionHttp = new TransactionHttp(networkProperties.nodeUrl);
        const address = Address.createFromRawAddress(account.address);
        const { publicKey } = account;

        const baseSearchCriteria = { 
            pageNumber,
            pageSize,
            group,
            order: Order.Desc 
        };

        if (filter.direction === 'sent') {
            baseSearchCriteria.signerPublicKey = publicKey;
        } else if (filter.direction === 'received') {
            baseSearchCriteria.recipientAddress = address;
        } else {
            baseSearchCriteria.address = address;
        }

        const transactionPage = await transactionHttp.search(baseSearchCriteria).toPromise();
        const transactions = transactionPage.data;

        const aggregateTransactionIds = transactions.filter(isAggregateTransaction).map(transaction => transaction.transactionInfo.id);
        const shouldFetchAggregateDetails = aggregateTransactionIds.length > 0;
        const aggregateDetails = shouldFetchAggregateDetails ? await transactionHttp.getTransactionsById(aggregateTransactionIds, group).toPromise() : [];
        //return transactions// .map(transaction => transactionFromDTO(transaction, networkProperties));

        return transactions.map(transaction => 
            isAggregateTransaction(transaction) 
                ? aggregateDetails.find(details => details.transactionInfo.id === transaction.transactionInfo.id)
                : transaction
        );
    }
};
