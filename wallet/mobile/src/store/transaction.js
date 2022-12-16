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
            
            commit({type: 'transaction/setConfirmed', payload: accountTransactions});
            commit({type: 'transaction/setIsLastPage', payload: false});
        },
        fetchData: async ({ commit, state }) => {
            const { networkProperties } = state.network;
            const { current } = state.account;

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
            const partial = partialDTO.map(transactionDTO => transactionFromDTO(transactionDTO, transactionOptions));
            const unconfirmed = unconfirmedDTO.map(transactionDTO => transactionFromDTO(transactionDTO, transactionOptions));
            const confirmed = confirmedDTO.map(transactionDTO => transactionFromDTO(transactionDTO, transactionOptions));
 
            // Update store
            commit({type: 'transaction/setPartial', payload: partial});
            commit({type: 'transaction/setUnconfirmed', payload: unconfirmed});
            commit({type: 'transaction/setConfirmed', payload: confirmed});
            commit({type: 'transaction/setIsLastPage', payload: false});

            // Cache transactions for current account
            const latestTransactions = await PersistentStorage.getLatestTransactions();
            latestTransactions[current.address] = confirmed;
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
            console.log({namespaceNames, resolvedAddresses})
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

            const updatedConfirmed = _.uniqBy([...confirmed, ...confirmedPage], 'id');
            // Update store
            commit({type: 'transaction/setConfirmed', payload: updatedConfirmed});
            commit({type: 'transaction/setIsLastPage', payload: isLastPage});
        }
    },
};
