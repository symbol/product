import { AccountService } from './AccountService';
import { makeRequest } from '@/app/utils/network';
import { symbolTransactionFromPayload } from '@/app/utils/transaction';
import { getUnresolvedIdsFromTransactionDTOs, isAggregateTransactionDTO, transactionFromDTO } from '@/app/utils/transaction-from-dto';
import { MosaicService } from '@/app/lib/services/MosaicService';
import { NamespaceService } from '@/app/lib/services/NamespaceService';
import { getUnresolvedIdsFromSymbolTransactions, transactionFromSymbol } from '@/app/utils/transaction-from-symbol';
import { promiseAllSettled } from '@/app/utils';
import { TransactionAnnounceGroup, TransactionGroup } from '@/app/constants';
import * as AccountTypes from '@/app/types/Account';
import * as MosaicTypes from '@/app/types/Mosaic';
import * as NetworkTypes from '@/app/types/Network';
import * as SearchCriteriaTypes from '@/app/types/SearchCriteria';
import * as TransactionTypes from '@/app/types/Transaction';

export class TransactionService {
    /**
     * Fetches transactions of an account.
     * @param {AccountTypes.PublicAccount} account - Requested account.
     * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
     * @param {SearchCriteriaTypes.TransactionSearchCriteria} searchCriteria - Search criteria.
     * @returns {Promise<TransactionTypes.Transaction[]>} - The account transactions.
     */
    static async fetchAccountTransactions(account, networkProperties, searchCriteria) {
        const { pageNumber = 1, pageSize = 15, group = TransactionGroup.CONFIRMED, order = 'desc', filter = {} } = searchCriteria;
        const baseUrl = `${networkProperties.nodeUrl}/transactions/${group}`;
        const baseSearchCriteria = {
            pageNumber,
            pageSize,
            group,
            order,
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
        const aggregateTransactionHashes = transactions.filter(isAggregateTransactionDTO).map((transactionDTO) => transactionDTO.meta.hash);
        let aggregateDetailedDTOs = [];
        if (aggregateTransactionHashes.length) {
            const transactionDetailsUrl = `${networkProperties.nodeUrl}/transactions/${group}`;
            aggregateDetailedDTOs = await makeRequest(transactionDetailsUrl, {
                method: 'POST',
                body: JSON.stringify({ transactionIds: aggregateTransactionHashes }),
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        }

        // Merge aggregate transaction details with the list of transactions
        const transactionsWithAggregate = transactions.map((transactionDTO) =>
            isAggregateTransactionDTO(transactionDTO)
                ? aggregateDetailedDTOs.find((detailedDTO) => detailedDTO.meta.hash === transactionDTO.meta.hash)
                : transactionDTO
        );

        return TransactionService.resolveTransactionDTOs(transactionsWithAggregate, networkProperties, account);
    }

    /**
     * Fetches transaction info by hash.
     * @param {string} hash - Requested transaction hash.
     * @param {Object} config - Config.
     * @param {NetworkTypes.NetworkProperties} config.networkProperties - Network properties.
     * @param {AccountTypes.PublicAccount} config.currentAccount - Current account.
     * @param {string} config.group - Transaction group.
     * @returns {Promise<TransactionTypes.Transaction>} - The transaction info.
     */
    static async fetchTransactionInfo(hash, config) {
        const { group = TransactionGroup.CONFIRMED, currentAccount, networkProperties } = config;
        const transactionUrl = `${networkProperties.nodeUrl}/transactions/${group}/${hash}`;
        const transactionDTO = await makeRequest(transactionUrl);
        const transactions = await TransactionService.resolveTransactionDTOs([transactionDTO], networkProperties, currentAccount);

        return transactions[0];
    }

    /**
     * Send transaction to the network.
     * @param {TransactionTypes.SignedTransactionDTO} dto - The signed transaction DTO.
     * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
     * @param {string} type - Transaction announce group.
     * @returns {Promise<void>} - A promise that resolves when the transaction is announced.
     * @throws {Error} - If the transaction is not accepted by any node.
     */
    static async announceTransaction(dto, networkProperties, type) {
        const randomNodes = networkProperties.nodeUrls.sort(() => Math.random() - 0.5).slice(0, 3);
        const nodeUrls = [networkProperties.nodeUrl, ...randomNodes];
        const promises = nodeUrls.map((nodeUrl) => this.announceTransactionToNode(dto, nodeUrl, type));

        const results = await promiseAllSettled(promises);
        const hasSuccessfulResult = results.some((r) => r.status === 'fulfilled');

        if (!hasSuccessfulResult) {
            const error = results.find((r) => r.status === 'rejected').reason;
            throw new Error(error);
        }
    }

    /**
     * Announce transaction to a single node.
     * @param {TransactionTypes.SignedTransactionDTO} dto - The signed transaction DTO.
     * @param {string} nodeUrl - The node URL.
     * @param {string} type - Transaction announce group.
     * @returns {Promise<void>} - A promise that resolves when the transaction is announced.
     * @throws {Error} - If the transaction is not accepted by the node.
     */
    static async announceTransactionToNode(dto, nodeUrl, type = TransactionAnnounceGroup.DEFAULT) {
        const typeEndpointMap = {
            [TransactionAnnounceGroup.DEFAULT]: '/transactions',
            [TransactionAnnounceGroup.PARTIAL]: '/transactions/partial',
            [TransactionAnnounceGroup.COSIGNATURE]: '/transactions/cosignature',
        };
        const endpoint = `${nodeUrl}${typeEndpointMap[type]}`;

        return makeRequest(endpoint, {
            method: 'PUT',
            body: JSON.stringify(dto),
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    static async fetchStatus(hash, networkProperties) {
        const endpoint = `${networkProperties.nodeUrl}/transactionStatus/${hash}`;
        const { group } = await makeRequest(endpoint);

        return {
            group,
        };
    }

    /**
     * Resolves addresses, mosaics and namespaces for transaction DTOs.
     * @param {Object} data - The transaction data, containing unresolved ids.
     * @param {string[]} data.addresses - The namespace ids of the unresolved addresses aliases.
     * @param {string[]} data.mosaicIds - The ids of the unresolved mosaics.
     * @param {string[]} data.namespaceIds - The ids of the unresolved namespaces.
     * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
     * @returns {Promise<{ mosaicInfos: Object.<string, MosaicTypes.MosaicInfo>, namespaceNames: Object.<string, string>, resolvedAddresses: Object.<string, string> }>} - The resolved data.
     */
    static async resolveTransactionData(data, networkProperties) {
        // Resolve addresses, mosaics and namespaces
        const { addresses, mosaicIds, namespaceIds } = data;
        const mosaicInfos = await MosaicService.fetchMosaicInfos(networkProperties, mosaicIds);
        const namespaceNames = await NamespaceService.fetchNamespaceNames(networkProperties, namespaceIds);
        const resolvedAddresses = await NamespaceService.resolveAddressesAtHeight(networkProperties, addresses);

        return {
            mosaicInfos,
            namespaceNames,
            resolvedAddresses,
        };
    }

    /**
     * Resolves transactions DTO. Fetches additional information for unresolved ids. Maps transactionDTOs to the transaction objects.
     * @param {Object[]} transactionDTOs - The transaction DTOs.
     * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
     * @param {AccountTypes.PublicAccount} currentAccount - Current account.
     * @returns {Promise<TransactionTypes.Transaction[]>} - The resolved transactions
     */
    static async resolveTransactionDTOs(transactionDTOs, networkProperties, currentAccount) {
        const unresolvedTransactionData = getUnresolvedIdsFromTransactionDTOs(transactionDTOs);
        const resolvedTransactionData = await TransactionService.resolveTransactionData(unresolvedTransactionData, networkProperties);
        const config = {
            ...resolvedTransactionData,
            currentAccount,
            networkProperties,
        };
        return transactionDTOs.map((transactionDTO) => transactionFromDTO(transactionDTO, config));
    }

    /**
     * Creates a transaction object from a payload. Resolves amounts and ids.
     * @param {string} payload - The transaction payload.
     * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
     * @param {AccountTypes.PublicAccount} currentAccount - Current account.
     * @param {string} [fillSignerPublickey] - The public key to fill the signer if field is empty.
     * @returns {Promise<TransactionTypes.Transaction>} - The transaction object.
     */
    static async resolveTransactionFromPayload(payload, networkProperties, currentAccount, fillSignerPublickey) {
        const symbolTransaction = symbolTransactionFromPayload(payload);
        const unresolvedTransactionData = getUnresolvedIdsFromSymbolTransactions([symbolTransaction]);
        const resolvedTransactionData = await TransactionService.resolveTransactionData(unresolvedTransactionData, networkProperties);
        const config = {
            ...resolvedTransactionData,
            currentAccount,
            networkProperties,
            fillSignerPublickey,
        };

        return transactionFromSymbol(symbolTransaction, config);
    }
}
