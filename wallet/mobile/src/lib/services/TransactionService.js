import { AccountService } from './AccountService';
import { makeRequest } from '@/utils/network';
import { symbolTransactionFromPayload } from '@/utils/transaction';
import { getUnresolvedIdsFromTransactionDTOs, isAggregateTransactionDTO, transactionFromDTO } from 'src/utils/transaction-from-dto';
import { MosaicService } from 'src/lib/services/MosaicService';
import { NamespaceService } from 'src/lib/services/NamespaceService';
import { getUnresolvedIdsFromSymbolTransactions, transactionFromSymbol } from 'src/utils/transaction-from-symbol';
import { promiseAllSettled } from 'src/utils';
import { TransactionAnnounceGroup, TransactionGroup } from 'src/constants';

export class TransactionService {
    static async fetchAccountTransactions(account, networkProperties, { pageNumber = 1, pageSize = 15, group = TransactionGroup.CONFIRMED, filter = {} }) {
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

    static async fetchTransactionInfo(hash, config) {
        const { group = TransactionGroup.CONFIRMED, currentAccount, networkProperties } = config;
        const transactionUrl = `${networkProperties.nodeUrl}/transactions/${group}/${hash}`;
        const transactionDTO = await makeRequest(transactionUrl);
        const transactions = await TransactionService.resolveTransactionDTOs([transactionDTO], networkProperties, currentAccount);

        return transactions[0];
    }

    static async announceBatchNode(dto, networkProperties, type) {
        const randomNodes = networkProperties.nodeUrls.sort(() => Math.random() - 0.5).slice(0, 3);
        const nodeUrls = [networkProperties.nodeUrl, ...randomNodes];
        const promises = nodeUrls.map((nodeUrl => this.announce(dto, nodeUrl, type)));

        const results = await promiseAllSettled(promises);
        const hasSuccessfulResult = results.some((r) => r.status === 'fulfilled');

        if (!hasSuccessfulResult) {
            const error = results.find((r) => r.status === 'rejected').reason;
            throw new Error(error);
        }
    }

    static async announce(dto, nodeUrl, type = TransactionAnnounceGroup.DEFAULT) {
        const typeEndpointMap = {
            [TransactionAnnounceGroup.DEFAULT]: '/transactions',
            [TransactionAnnounceGroup.PARTIAL]: '/transactions/partial',
            [TransactionAnnounceGroup.COSIGNATURE]: '/transactions/cosignature',
        }
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
