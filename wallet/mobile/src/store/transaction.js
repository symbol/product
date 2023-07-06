import _ from 'lodash';
import { MosaicService, NamespaceService, TransactionService } from 'src/services';
import { PersistentStorage } from 'src/storage';
import {
    filterAllowedTransactions,
    filterBlacklistedTransactions,
    getUnresolvedIdsFromTransactionDTOs,
    transactionFromDTO,
} from 'src/utils';

export default {
    namespace: 'transaction',
    state: {
        partial: [], // List of the Aggregate Bonded transactions, which are awaiting signature
        unconfirmed: [], // List of transactions awaiting confirmation by the network
        confirmed: [], // List of confirmed transactions
        isLastPage: false, // Wether the end of the account transaction list is reached
    },
    mutations: {
        setPartial(state, payload) {
            state.transaction.partial = payload;
            return state;
        },
        setUnconfirmed(state, payload) {
            state.transaction.unconfirmed = payload;
            return state;
        },
        setConfirmed(state, payload) {
            state.transaction.confirmed = payload;
            return state;
        },
        setIsLastPage(state, payload) {
            state.transaction.isLastPage = payload;
            return state;
        },
    },
    actions: {
        // Load data from cache or set an empty values
        loadState: async ({ commit, state }) => {
            const { current } = state.account;
            const latestTransactions = await PersistentStorage.getLatestTransactions();
            const accountTransactions = latestTransactions[current?.address] || [];

            commit({ type: 'transaction/setConfirmed', payload: accountTransactions });
            commit({ type: 'transaction/setPartial', payload: [] });
            commit({ type: 'transaction/setUnconfirmed', payload: [] });
            commit({ type: 'transaction/setIsLastPage', payload: false });
        },
        // Fetch the latest partial, unconfirmed and confirmed transaction lists from API
        fetchData: async ({ commit, state }, payload = {}) => {
            const { keepPages, filter } = payload;
            const { networkProperties } = state.network;
            const { current } = state.account;
            const { confirmed } = state.transaction;
            const { blackList } = state.addressBook;

            // Fetch transactions from DTO
            const [partialDTO, unconfirmedDTO, confirmedDTO] = await Promise.all([
                TransactionService.fetchAccountTransactions(current, networkProperties, { group: 'partial', filter }),
                TransactionService.fetchAccountTransactions(current, networkProperties, { group: 'unconfirmed', filter }),
                TransactionService.fetchAccountTransactions(current, networkProperties, { group: 'confirmed', filter }),
            ]);

            // Fetch mosaic infos for transactions
            const { addresses, mosaicIds, namespaceIds } = getUnresolvedIdsFromTransactionDTOs([
                ...partialDTO,
                ...unconfirmedDTO,
                ...confirmedDTO,
            ]);
            const mosaicInfos = await MosaicService.fetchMosaicInfos(networkProperties, mosaicIds);
            const namespaceNames = await NamespaceService.fetchNamespaceNames(networkProperties, namespaceIds);
            const resolvedAddresses = await NamespaceService.resolveAddresses(networkProperties, addresses);

            // Format transactions
            const transactionOptions = {
                networkProperties,
                currentAccount: current,
                mosaicInfos,
                namespaceNames,
                resolvedAddresses,
            };
            const partialPage = partialDTO.map((transactionDTO) => transactionFromDTO(transactionDTO, transactionOptions));
            const unconfirmedPage = unconfirmedDTO.map((transactionDTO) => transactionFromDTO(transactionDTO, transactionOptions));
            const confirmedPage = confirmedDTO.map((transactionDTO) => transactionFromDTO(transactionDTO, transactionOptions));

            //Filter allowed
            let filteredPartialPage;
            let filteredUnconfirmedPage;
            let filteredConfirmedPage;

            if (filter?.blocked) {
                filteredPartialPage = filterBlacklistedTransactions(partialPage, blackList);
                filteredUnconfirmedPage = filterBlacklistedTransactions(unconfirmedPage, blackList);
                filteredConfirmedPage = filterBlacklistedTransactions(confirmedPage, blackList);
            } else {
                filteredPartialPage = filterAllowedTransactions(partialPage, blackList);
                filteredUnconfirmedPage = filterAllowedTransactions(unconfirmedPage, blackList);
                filteredConfirmedPage = filterAllowedTransactions(confirmedPage, blackList);
            }

            // Update store
            commit({ type: 'transaction/setPartial', payload: filteredPartialPage });
            commit({ type: 'transaction/setUnconfirmed', payload: filteredUnconfirmedPage });

            if (keepPages) {
                const updatedConfirmed = _.uniqBy([...filteredConfirmedPage, ...confirmed], 'id');
                commit({ type: 'transaction/setConfirmed', payload: updatedConfirmed });
            } else {
                commit({ type: 'transaction/setConfirmed', payload: filteredConfirmedPage });
                commit({ type: 'transaction/setIsLastPage', payload: false });
            }

            // Cache transactions for current account
            const isFilterActivated = filter && Object.keys(filter).length > 0;
            if (!isFilterActivated) {
                const latestTransactions = await PersistentStorage.getLatestTransactions();
                latestTransactions[current.address] = confirmedPage;
                await PersistentStorage.setLatestTransactions(latestTransactions);
            }
        },
        // Fetch specific page of the confirmed transactions from API
        fetchPage: async ({ commit, state }, { pageNumber, filter }) => {
            const { networkProperties } = state.network;
            const { confirmed } = state.transaction;
            const { current } = state.account;
            const { blackList } = state.addressBook;

            // Fetch transactions from DTO
            const confirmedDTO = await TransactionService.fetchAccountTransactions(current, networkProperties, {
                group: 'confirmed',
                filter,
                pageNumber,
            });

            // Fetch mosaic infos for transactions
            const { addresses, mosaicIds, namespaceIds } = getUnresolvedIdsFromTransactionDTOs([...confirmedDTO]);
            const mosaicInfos = await MosaicService.fetchMosaicInfos(networkProperties, mosaicIds);
            const namespaceNames = await NamespaceService.fetchNamespaceNames(networkProperties, namespaceIds);
            const resolvedAddresses = await NamespaceService.resolveAddresses(networkProperties, addresses);

            // Format transactions
            const transactionOptions = {
                networkProperties,
                currentAccount: current,
                mosaicInfos,
                namespaceNames,
                resolvedAddresses,
            };
            const confirmedPage = confirmedDTO.map((transactionDTO) => transactionFromDTO(transactionDTO, transactionOptions));
            const isLastPage = confirmedPage.length === 0;

            //Filter allowed
            let filteredConfirmedPage;
            if (filter?.blocked) {
                filteredConfirmedPage = filterBlacklistedTransactions(confirmedPage, blackList);
            } else {
                filteredConfirmedPage = filterAllowedTransactions(confirmedPage, blackList);
            }
            const updatedConfirmed = _.uniqBy([...confirmed, ...filteredConfirmedPage], 'hash');

            // Update store
            commit({ type: 'transaction/setConfirmed', payload: updatedConfirmed });
            commit({ type: 'transaction/setIsLastPage', payload: isLastPage });
        },
    },
};
