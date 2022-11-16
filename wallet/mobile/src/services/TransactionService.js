import { isAggregateTransaction } from '@src/utils';
import _ from 'lodash';
import { Address, Order, RepositoryFactoryHttp, TransactionGroup, TransactionService as SymbolTransactionService, TransactionType } from 'symbol-sdk';

export class TransactionService {
    static async fetchAccountTransactions(account, networkProperties, preLoadedMosaics, { 
        pageNumber = 1, 
        pageSize = 15, 
        group = 'confirmed', 
        filter = '', 
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

        if (filter === 'sent') {
            baseSearchCriteria.signerPublicKey = publicKey;
        } else if (filter === 'received') {
            baseSearchCriteria.recipientAddress = address;
        } else {
            baseSearchCriteria.address = address;
        }

        const searchPromises = [];
        searchPromises.push(transactionHttp.search(baseSearchCriteria).toPromise());

        if (group === 'partial') {
            account.cosignatoryOf.forEach(multisigAccount => {
                const multisigSearchCriteria = {
                    ...baseSearchCriteria,
                    address: Address.createFromRawAddress(multisigAccount.address)
                };
                
                searchPromises.push(transactionHttp.search(multisigSearchCriteria).toPromise());
            });
        }

        const transactionPages = await Promise.all(searchPromises);
        const transactionsUnfiltered = transactionPages.map(page => page.data).flat();
        const transactions = _.uniqBy(transactionsUnfiltered, tx => tx.transactionInfo.hash);
            

        return Promise.all(transactions.map(async transaction => {
                if (!isAggregateTransaction(transaction)) {
                    //return FormatTransaction.format(transaction, network, preLoadedMosaics);
                    return transaction;
                }
                const aggregateTransaction = await this.fetchTransactionDetails(transaction.transactionInfo.id, group);

                //return FormatTransaction.format(aggregateTransactionDetails, network, preLoadedMosaics);

                return aggregateTransaction;
            })
        );
    }

    static async fetchTransactionDetails(networkProperties, id, group, preLoadedMosaics) {
        const transactionHttp = new TransactionHttp(networkProperties.nodeUrl);
        const transactionDetails = await transactionHttp
            .getTransaction(id, group)
            .toPromise();
        
            //return FormatTransaction.format(transaction, network, preLoadedMosaics);
        return transactionDetails;
    }

    static async announceTransaction(transaction, networkProperties) {
        const repositoryFactory = new RepositoryFactoryHttp(networkProperties.nodeUrl);
        const listener = repositoryFactory.createListener();
        const receiptHttp = repositoryFactory.createReceiptRepository();
        const transactionHttp = repositoryFactory.createTransactionRepository();
        const transactionService = new SymbolTransactionService(transactionHttp, receiptHttp);

        if (isAggregateTransaction(transaction)) {
            await listener.open();
            return new Promise((resolve, reject) => {
                transactionService
                    .announceHashLockAggregateBonded(
                        signedHashLockTransaction,
                        signedTransaction,
                        listener,
                    )
                    .subscribe(
                        resolve,
                        reject,
                        () => listener.close(),
                    );
            });
        }
        else {
            return transactionHttp.announce(transaction).toPromise();
        }
    }

    static async cosignTransaction(transaction, networkProperties) {
        const transactionHttp = new TransactionHttp(networkProperties.nodeUrl);
        return transactionHttp.announceAggregateBondedCosignature(transaction).toPromise();
    }
};
