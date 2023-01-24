import _ from 'lodash';
import { MosaicService, NamespaceService, TransactionService } from 'src/services';
import { PersistentStorage } from 'src/storage';
import { getUnresolvedIdsFromTransactionDTOs, transactionFromDTO } from 'src/utils';

export default {
    namespace: 'transaction',
    state: {
        partial: [],
        unconfirmed: [],
        confirmed: [],
        isLastPage: false
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
        loadState: async ({ commit, state }) => {
            const { current } = state.account;
            const latestTransactions = await PersistentStorage.getLatestTransactions();
            const accountTransactions = latestTransactions[current?.address] || [];
            console.log(`[Transaction] load transactions from cache for ${current?.address}`, accountTransactions.length)
            
            commit({type: 'transaction/setConfirmed', payload: accountTransactions});
            commit({type: 'transaction/setPartial', payload: []});
            commit({type: 'transaction/setUnconfirmed', payload: []});
            commit({type: 'transaction/setIsLastPage', payload: false});
        },
        fetchData: async ({ commit, state }, keepPages) => {
            const { networkProperties } = state.network;
            const { current } = state.account;
            const { confirmed } = state.transaction;

            // Fetch transactions from DTO
            const [partialDTO, unconfirmedDTO, confirmedDTO] = await Promise.all([
                TransactionService.fetchAccountTransactions(current, networkProperties, {group: 'partial'}),
                TransactionService.fetchAccountTransactions(current, networkProperties, {group: 'unconfirmed'}),
                TransactionService.fetchAccountTransactions(current, networkProperties, {group: 'confirmed'}),
            ]);

            // Fetch mosaic infos for transactions
            const { addresses, mosaicIds, namespaceIds } = getUnresolvedIdsFromTransactionDTOs([...partialDTO, ...unconfirmedDTO, ...confirmedDTO]);
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
            const partialPage = partialDTO.map(transactionDTO => transactionFromDTO(transactionDTO, transactionOptions));
            const unconfirmedPage = unconfirmedDTO.map(transactionDTO => transactionFromDTO(transactionDTO, transactionOptions));
            const confirmedPage = confirmedDTO.map(transactionDTO => transactionFromDTO(transactionDTO, transactionOptions));

            // Update store
            commit({type: 'transaction/setPartial', payload: partialPage});
            commit({type: 'transaction/setUnconfirmed', payload: unconfirmedPage});
            
            if (keepPages) {
                const updatedConfirmed = _.uniqBy([...confirmedPage, ...confirmed], 'id');
                commit({type: 'transaction/setConfirmed', payload: updatedConfirmed});
            }
            else {
                commit({type: 'transaction/setConfirmed', payload: confirmedPage});
                commit({type: 'transaction/setIsLastPage', payload: false});
            }

            // Cache transactions for current account
            const latestTransactions = await PersistentStorage.getLatestTransactions();
            latestTransactions[current.address] = confirmedPage;
            await PersistentStorage.setLatestTransactions(latestTransactions);
        },
        fetchPage: async ({ commit, state }, { pageNumber, filters }) => {
            const { networkProperties } = state.network;
            const { confirmed } = state.transaction;
            const { current } = state.account;

            // Fetch transactions from DTO
            const confirmedDTO = await TransactionService.fetchAccountTransactions(current, networkProperties, {group: 'confirmed', pageNumber});

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
            const confirmedPage = confirmedDTO.map(transactionDTO => transactionFromDTO(transactionDTO, transactionOptions));
            const isLastPage = confirmedPage.length === 0;

            const updatedConfirmed = _.uniqBy([...confirmed, ...confirmedPage], 'hash');
            // Update store
            commit({type: 'transaction/setConfirmed', payload: updatedConfirmed});
            commit({type: 'transaction/setIsLastPage', payload: isLastPage});
        },
    },
};
