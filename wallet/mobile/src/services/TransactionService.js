import { isAggregateTransaction, makeRequest, networkIdentifierToNetworkType, transferTransactionToDTO } from 'src/utils';
import _ from 'lodash';
import { Account, Address, Order, TransactionHttp } from 'symbol-sdk';
import { Duration, Instant, LocalDateTime, ZoneId } from '@js-joda/core';
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

        return transactions.map(transaction => 
            isAggregateTransaction(transaction) 
                ? aggregateDetails.find(details => details.transactionInfo.id === transaction.transactionInfo.id)
                : transaction
        );
    }

    static async sendTransferTransaction(transaction, account, networkProperties) {
        const networkType = networkIdentifierToNetworkType(networkProperties.networkIdentifier);
        const transactionDTO = transferTransactionToDTO(transaction, networkProperties);
        const signedTransaction = Account
            .createFromPrivateKey(account.privateKey, networkType)
            .sign(transactionDTO, networkProperties.generationHash);
        const transactionHttp = new TransactionHttp(networkProperties.nodeUrl);

        return transactionHttp.announce(signedTransaction).toPromise();
    }

    static async fetchDate(height, networkProperties) {
        const endpoint = `${networkProperties.nodeUrl}/blocks/${height}`;
        const { block } = await makeRequest(endpoint);
        const timestamp = parseInt(block.timestamp);

        return LocalDateTime.ofInstant(
            Instant.ofEpochMilli(timestamp).plusMillis(Duration.ofSeconds(networkProperties.epochAdjustment).toMillis()),
            ZoneId.SYSTEM,
        );
    }

    static async fetchStatus(hash, networkProperties) {
        const endpoint = `${networkProperties.nodeUrl}/transactionStatus/${hash}`;
        const { group } = await makeRequest(endpoint);

        return {
            group
        };
    }
};
