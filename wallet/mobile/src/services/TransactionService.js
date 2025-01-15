import { TransactionType } from '@/constants';
import { AccountService } from './AccountService';
import { ListenerService } from './ListenerService';
import { makeRequest } from '@/utils/network';
import { decryptMessage, signTransaction, symbolTransactionFromPayload } from '@/utils/transaction';
import { getUnresolvedIdsFromTransactionDTOs, isAggregateTransactionDTO, transactionFromDTO } from 'src/utils/transaction-from-dto';
import { MosaicService } from 'src/services/MosaicService';
import { NamespaceService } from 'src/services/NamespaceService';
import { getUnresolvedIdsFromSymbolTransactions, transactionFromSymbol } from 'src/utils/transaction-from-symbol';

export class TransactionService {
    static async fetchAccountTransactions(account, networkProperties, { pageNumber = 1, pageSize = 100, group = 'confirmed', filter = {} }) {
        const baseUrl = `${networkProperties.nodeUrl}/transactions/${group}`;
        const baseSearchCriteria = {
            pageNumber,
            pageSize,
            group,
            order: 'desc',
        };

        // Set search criteria filters
        if (filter.from) {
            const fromAccount = await AccountService.fetchAccountInfo(networkProperties, filter.from);
            baseSearchCriteria.signerPublicKey = fromAccount.publicKey;
            baseSearchCriteria.recipientAddress = account.address;

        } else if (filter.to) {
            baseSearchCriteria.signerPublicKey = account.publicKey;
            baseSearchCriteria.recipientAddress = filter.to;
        } else {
            baseSearchCriteria.address = account.address;
        }
        if (filter.type) {
            baseSearchCriteria.type = filter.type;
        }

        // Fetch transactions
        const params = new URLSearchParams(baseSearchCriteria).toString();
        const transactionPage = await makeRequest(`${baseUrl}?${params}`);
        const transactions = transactionPage.data;

        // Aggregate transactions info is limited. We need to fetch details for each aggregate transaction and include them in the list
        const aggregateTransactionHashes = transactions
            .filter(isAggregateTransactionDTO)
            .map((transactionDTO) => transactionDTO.meta.hash);
        let aggregateDetailedDTOs = [];
        if (aggregateTransactionHashes.length) {
            transactionDetailsUrl = `${networkProperties.nodeUrl}/transactions/${group}`;
            aggregateDetailedDTOs = await makeRequest(transactionDetailsUrl, {
                method: 'POST',
                body: JSON.stringify({ transactionIds: aggregateTransactionHashes }),
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        }

        // Merge aggregate transaction details with the list of transactions
        const transactionsWithAggregate =  transactions.map((transactionDTO) =>
            isAggregateTransactionDTO(transactionDTO)
                ? aggregateDetailedDTOs.find((detailedDTO) => detailedDTO.meta.hash === transactionDTO.meta.hash)
                : transactionDTO
        );

        return TransactionService.resolveTransactionDTOs(transactionsWithAggregate, networkProperties, account);
    }

    static async signAndAnnounce(transaction, networkProperties, privateAccount) {
        return new Promise(async (resolve) => {
            const signedTransaction = await signTransaction(networkProperties, transaction, privateAccount);

            if (transaction.type !== TransactionType.AGGREGATE_BONDED) {
                return resolve(this.announceBatchNode(signedTransaction.payload, networkProperties, false));
            }

            const hashLockTransaction = {
                type: TransactionType.HASH_LOCK,
                signerPublicKey: privateAccount.publicKey,
                lockedAmount: 10,
                fee: 0.1,
                duration: 1000,
                aggregateHash: signedTransaction.hash
            };
            const signedHashLockTransaction = await signTransaction(networkProperties, hashLockTransaction, privateAccount);

            const listener = new ListenerService(networkProperties, privateAccount);
            await listener.open();
            listener.listenTransactions((transaction) => {
                if (transaction.hash === signedHashLockTransaction.hash) {
                    listener.close();
                    return resolve(this.announceBatchNode(signedTransaction.payload, networkProperties, true));
                }
            })

            await this.announceBatchNode(signedHashLockTransaction.payload, networkProperties, false);
        })
    }

    static async announceBatchNode(transactionPayload, networkProperties, isPartial) {
        const nodeUrls = networkProperties.nodeUrls.slice(0, 5);
        const promises = nodeUrls.map((nodeUrl => this.announce(transactionPayload, nodeUrl, isPartial)));

        return Promise.all(promises);
    }

    static async announce(transactionPayload, nodeUrl, isPartial) {
        const endpoint = `${nodeUrl}/transactions${isPartial ? '/partial' : ''}`;
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

    static async decryptMessage(transaction, currentAccount, networkProperties) {
        if (transaction.type !== TransactionType.TRANSFER)
            throw Error('error_failed_decrypt_message_invalid_transaction_type');

        if (!transaction.message.isEncrypted)
            return transaction.message.text;

        if (isIncomingTransaction(transaction, currentAccount))
            return decryptMessage(transaction.message.encryptedText, transaction.signerPublicKey, currentAccount.privateKey);

        if (isOutgoingTransaction(transaction, currentAccount)) {
            const recipientAccount = await AccountService.fetchAccountInfo(networkProperties, transaction.recipientAddress);

            return decryptMessage(transaction.message.encryptedText, recipientAccount.publicKey, currentAccount.privateKey);
        }

        throw Error('error_failed_decrypt_message_not_related');
    }

    static async fetchStatus(hash, networkProperties) {
        const endpoint = `${networkProperties.nodeUrl}/transactionStatus/${hash}`;
        const { group } = await makeRequest(endpoint);

        return {
            group,
        };
    }

    static async resolveTransactions(transactionDTOs, networkProperties, currentAccount, config) {
        const { unresolvedExtractor, transactionMapper, mapperConfig = {} } = config;
        // Resolve addresses, mosaics and namespaces
        const { addresses, mosaicIds, namespaceIds } = unresolvedExtractor(transactionDTOs);
        const mosaicInfos = await MosaicService.fetchMosaicInfos(networkProperties, mosaicIds);
        const namespaceNames = await NamespaceService.fetchNamespaceNames(networkProperties, namespaceIds);
        const resolvedAddresses = await NamespaceService.resolveAddresses(networkProperties, addresses);

        // Format transactions
        const transactionOptions = {
            networkProperties,
            currentAccount,
            mosaicInfos,
            namespaceNames,
            resolvedAddresses,
            ...mapperConfig,
        };
        
        return transactionDTOs.map((transactionDTO) => transactionMapper(transactionDTO, transactionOptions));
    }

    static async resolveTransactionDTOs(transactionDTOs, networkProperties, currentAccount, mapperConfig) {
        const config = {
            unresolvedExtractor: getUnresolvedIdsFromTransactionDTOs,
            transactionMapper: transactionFromDTO,
            mapperConfig
        };

        return TransactionService.resolveTransactions(transactionDTOs, networkProperties, currentAccount, config);
    }

    static resolveSymbolTransactions(transactions, networkProperties, currentAccount, mapperConfig) {
        const config = {
            unresolvedExtractor: getUnresolvedIdsFromSymbolTransactions,
            transactionMapper: transactionFromSymbol,
            mapperConfig,
        };

        return TransactionService.resolveTransactions(transactions, networkProperties, currentAccount, config);
    }

    static async transactionFromPayload(payload, networkProperties, currentAccount, fillSignerPublickey) {
        const symbolTransaction = symbolTransactionFromPayload(payload);
        const mapperConfig = { fillSignerPublickey };

        return (await TransactionService.resolveSymbolTransactions([symbolTransaction], networkProperties, currentAccount, mapperConfig))[0];
    }
}