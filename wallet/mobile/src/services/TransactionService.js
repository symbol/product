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

        return transactions.map(transaction => transactionFromDTO(transaction, networkProperties));
    }
};
