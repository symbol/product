import {
    decryptMessage,
    hashLockTransactionToDTO,
    isAggregateTransaction,
    isIncomingTransaction,
    isOutgoingTransaction,
    isSymbolAddress,
    makeRequest,
    networkIdentifierToNetworkType,
    publicAccountFromPrivateKey,
    timestampToLocalDate,
    transactionFromDTO,
    transactionToDTO,
    transferTransactionToDTO,
} from 'src/utils';
import { AccountService, ListenerService, NamespaceService } from 'src/services';
import {
    Account,
    Address,
    AggregateTransaction,
    CosignatureTransaction,
    Deadline,
    MosaicSupplyChangeAction,
    Order,
    PublicAccount,
    RepositoryFactoryHttp,
    TransactionService as SymbolTransactionService,
    TransactionHttp,
    TransactionType,
} from 'symbol-sdk';
import { Constants } from 'src/config';
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
        const transactionWithResolvedAddress = { ...transaction };
        const isMultisigTransaction = !!transaction.sender;
        const recipient = transaction.recipientAddress || transaction.recipient;

        // Resolve recipient address
        if (isSymbolAddress(recipient)) {
            transactionWithResolvedAddress.recipientAddress = recipient;
        } else {
            transactionWithResolvedAddress.recipientAddress = await NamespaceService.namespaceNameToAddress(
                networkProperties,
                recipient.toLowerCase()
            );
        }

        // If message is encrypted, fetch recipient publicKey
        if (transactionWithResolvedAddress.message?.isEncrypted) {
            const recipientAccount = await AccountService.fetchAccountInfo(
                networkProperties,
                transactionWithResolvedAddress.recipientAddress
            );
            transactionWithResolvedAddress.recipientPublicKey = recipientAccount.publicKey;
        }

        // If transaction is multisig use sender address as Transfer's signer
        if (isMultisigTransaction) {
            transactionWithResolvedAddress.signerAddress = transaction.sender;
        }

        // Prepare
        const transactionDTO = transferTransactionToDTO(transactionWithResolvedAddress, networkProperties, account);
        const currentAccount = Account.createFromPrivateKey(account.privateKey, networkType);
        const transactionHttp = new TransactionHttp(networkProperties.nodeUrl);

        // If transaction is multisig, announce Aggregate Bonded
        if (isMultisigTransaction) {
            const senderAccount = await AccountService.fetchAccountInfo(networkProperties, transaction.sender);
            const senderPublicAccount = PublicAccount.createFromPublicKey(senderAccount.publicKey, networkType);
            const aggregateTransactionDTO = AggregateTransaction.createBonded(
                Deadline.create(networkProperties.epochAdjustment),
                [transactionDTO.toAggregate(senderPublicAccount)],
                networkType,
                [],
                transactionDTO.maxFee
            );
            const signedTransaction = currentAccount.sign(aggregateTransactionDTO, networkProperties.generationHash);

            const hashLockTransaction = hashLockTransactionToDTO(networkProperties, signedTransaction, transaction.fee);
            const signedHashLockTransaction = currentAccount.sign(hashLockTransaction, networkProperties.generationHash);

            const repositoryFactory = new RepositoryFactoryHttp(networkProperties.nodeUrl, {
                websocketInjected: WebSocket,
            });
            const receiptHttp = repositoryFactory.createReceiptRepository();
            const symbolTransactionService = new SymbolTransactionService(transactionHttp, receiptHttp);
            const listener = repositoryFactory.createListener();
            await listener.open();

            await symbolTransactionService
                .announceHashLockAggregateBonded(signedHashLockTransaction, signedTransaction, listener)
                .toPromise();
            listener.close();
            return;
        }

        // Else, announce Transfer
        const signedTransaction = currentAccount.sign(transactionDTO, networkProperties.generationHash);

        return transactionHttp.announce(signedTransaction).toPromise();
    }

    static async sendMosaicCreationTransaction(transaction, account, networkProperties) {
        const accountPublicKey = publicAccountFromPrivateKey(account.privateKey, networkProperties.networkIdentifier).publicKey;
        const transactions = [];
        transactions.push({
            type: TransactionType.MOSAIC_DEFINITION,
            nonce: transaction.nonce,
            mosaicId: transaction.mosaicId,
            isSupplyMutable: transaction.isSupplyMutable,
            isTransferable: transaction.isTransferable,
            isRestrictable: transaction.isRestrictable,
            isRevokable: transaction.isRevokable,
            divisibility: transaction.divisibility,
            duration: transaction.duration,
            signerPublicKey: accountPublicKey,
        });
        transactions.push({
            type: TransactionType.MOSAIC_SUPPLY_CHANGE,
            mosaicId: transaction.mosaicId,
            action: Constants.MosaicSupplyChangeAction[MosaicSupplyChangeAction.Increase],
            delta: transaction.supply,
            signerPublicKey: accountPublicKey,
        });
        const aggregateTransaction = {
            type: TransactionType.AGGREGATE_COMPLETE,
            innerTransactions: transactions,
            signerPublicKey: accountPublicKey,
            fee: transaction.fee,
        };

        return TransactionService.signAndAnnounce(aggregateTransaction, account, networkProperties);
    }

    static async cosignTransaction(transaction, account, networkProperties) {
        const networkType = networkIdentifierToNetworkType(networkProperties.networkIdentifier);
        const cosignatureTransaction = CosignatureTransaction.create(transaction.signTransactionObject);
        const signedTransaction = Account.createFromPrivateKey(account.privateKey, networkType).signCosignatureTransaction(
            cosignatureTransaction
        );
        const endpoint = `${networkProperties.nodeUrl}/transactions/cosignature`;
        const payload = {
            parentHash: signedTransaction.parentHash,
            signature: signedTransaction.signature,
            signerPublicKey: signedTransaction.signerPublicKey,
            version: '0',
        };

        return makeRequest(endpoint, {
            method: 'PUT',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json',
            },
        });
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
        const transactionOptions = {
            networkProperties,
            currentAccount,
            mosaicInfos: {},
            namespaceNames: {},
            resolvedAddresses: {},
        };

        return transactionFromDTO(transactionDTO, transactionOptions);
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

    static async announce(transactionPayload, networkProperties) {
        const endpoint = `${networkProperties.nodeUrl}/transactions`;
        const payload = {
            payload: transactionPayload,
        };

        return makeRequest(endpoint, {
            method: 'PUT',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    static async announcePartial(transactionPayload, networkProperties) {
        const endpoint = `${networkProperties.nodeUrl}/transactions/partial`;
        const payload = {
            payload: transactionPayload,
        };

        return makeRequest(endpoint, {
            method: 'PUT',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    static async signAndAnnounce(transaction, account, networkProperties) {
        const networkType = networkIdentifierToNetworkType(networkProperties.networkIdentifier);
        const transactionDTO = transactionToDTO(transaction, networkProperties, account);
        const signedTransaction = Account.createFromPrivateKey(account.privateKey, networkType).sign(
            transactionDTO,
            networkProperties.generationHash
        );

        if (transaction.type === TransactionType.AGGREGATE_BONDED) {
            const hashLockTransaction = hashLockTransactionToDTO(networkProperties, signedTransaction, transaction.fee);
            const signedHashLockTransaction = Account.createFromPrivateKey(account.privateKey, networkType).sign(
                hashLockTransaction,
                networkProperties.generationHash
            );

            await TransactionService.announce(signedHashLockTransaction.payload, networkProperties);
            await ListenerService.awaitPartial(networkProperties, account.address, hashLockTransaction.hash);
            return TransactionService.announcePartial(signedTransaction.payload, networkProperties);
        }

        return TransactionService.announce(signedTransaction.payload, networkProperties);
    }
}
