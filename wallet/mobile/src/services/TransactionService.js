import {
    decryptMessage,
    isAggregateTransaction,
    isIncomingTransaction,
    isOutgoingTransaction,
    makeRequest,
    networkIdentifierToNetworkType,
    publicAccountFromPrivateKey,
    timestampToLocalDate,
    transactionFromDTO,
    transferTransactionToDTO,
} from 'src/utils';
import { AccountService } from 'src/services';
import { Account, Address, CosignatureTransaction, Order, TransactionHttp, TransactionType } from 'symbol-sdk';
export class TransactionService {
    static async fetchAccountTransactions(account, networkProperties, { pageNumber = 1, pageSize = 15, group = 'confirmed', filter = {} }) {
        const transactionHttp = new TransactionHttp(networkProperties.nodeUrl);
        const address = Address.createFromRawAddress(account.address);

        const baseSearchCriteria = {
            pageNumber,
            pageSize,
            group,
            order: Order.Desc,
        };

        if (filter.from) {
            const fromAccount = await AccountService.fetchAccountInfo(networkProperties, filter.from);
            baseSearchCriteria.signerPublicKey = fromAccount.publicKey;
            baseSearchCriteria.recipientAddress = address;
        } else if (filter.to) {
            const currentAccount = publicAccountFromPrivateKey(account.privateKey, networkProperties.networkIdentifier);
            baseSearchCriteria.signerPublicKey = currentAccount.publicKey;
            baseSearchCriteria.recipientAddress = Address.createFromRawAddress(filter.to);
        } else {
            baseSearchCriteria.address = address;
        }

        if (filter.type) {
            baseSearchCriteria.type = filter.type;
        }

        const transactionPage = await transactionHttp.search(baseSearchCriteria).toPromise();
        const transactions = transactionPage.data;

        const aggregateTransactionIds = transactions.filter(isAggregateTransaction).map((transaction) => transaction.transactionInfo.id);
        const shouldFetchAggregateDetails = aggregateTransactionIds.length > 0;
        const aggregateDetails = shouldFetchAggregateDetails
            ? await transactionHttp.getTransactionsById(aggregateTransactionIds, group).toPromise()
            : [];

        return transactions.map((transaction) =>
            isAggregateTransaction(transaction)
                ? aggregateDetails.find((details) => details.transactionInfo.id === transaction.transactionInfo.id)
                : transaction
        );
    }

    static async sendTransferTransaction(transaction, account, networkProperties) {
        const networkType = networkIdentifierToNetworkType(networkProperties.networkIdentifier);
        if (transaction.messageEncrypted) {
            const recipientAccount = await AccountService.fetchAccountInfo(networkProperties, transaction.recipientAddress);
            transaction.recipientPublicKey = recipientAccount.publicKey;
        }
        const transactionDTO = transferTransactionToDTO(transaction, networkProperties, account);
        const signedTransaction = Account.createFromPrivateKey(account.privateKey, networkType).sign(
            transactionDTO,
            networkProperties.generationHash
        );
        const transactionHttp = new TransactionHttp(networkProperties.nodeUrl);

        return transactionHttp.announce(signedTransaction).toPromise();
    }

    static async cosignTransaction(transaction, account, networkProperties) {
        const networkType = networkIdentifierToNetworkType(networkProperties.networkIdentifier);
        const cosignatureTransaction = CosignatureTransaction.create(transaction.signTransactionObject);
        const signedTransaction = Account.createFromPrivateKey(account.privateKey, networkType).signCosignatureTransaction(
            cosignatureTransaction
        );
        const transactionHttp = new TransactionHttp(networkProperties.nodeUrl);

        return transactionHttp.announceAggregateBondedCosignature(signedTransaction).toPromise();
    }

    static async fetchDate(height, networkProperties) {
        const endpoint = `${networkProperties.nodeUrl}/blocks/${height}`;
        const { block } = await makeRequest(endpoint);
        const timestamp = parseInt(block.timestamp);

        return timestampToLocalDate(timestamp, networkProperties.epochAdjustment);
    }

    static async fetchStatus(hash, networkProperties) {
        const endpoint = `${networkProperties.nodeUrl}/transactionStatus/${hash}`;
        const { group } = await makeRequest(endpoint);

        return {
            group,
        };
    }

    static async fetchPartialInfo(hash, currentAccount, networkProperties) {
        const transactionHttp = new TransactionHttp(networkProperties.nodeUrl);
        const transactionDTO = await transactionHttp.getTransaction(hash, 'partial').toPromise();

        return transactionFromDTO(transactionDTO, { networkProperties, currentAccount });
    }

    static async decryptMessage(transaction, currentAccount, networkProperties) {
        if (transaction.type !== TransactionType.TRANSFER) {
            throw Error('error_failed_decrypt_message_invalid_transaction_type');
        }

        if (!transaction.message.isEncrypted) {
            return transaction.message.text;
        }

        if (isIncomingTransaction(transaction, currentAccount)) {
            return decryptMessage(transaction.message.encryptedText, currentAccount.privateKey, transaction.signerPublicKey);
        }

        if (isOutgoingTransaction(transaction, currentAccount)) {
            const recipientAccount = await AccountService.fetchAccountInfo(networkProperties, transaction.recipientAddress);

            return decryptMessage(transaction.message.encryptedText, currentAccount.privateKey, recipientAccount.publicKey);
        }

        throw Error('error_failed_decrypt_message_not_related');
    }
}
