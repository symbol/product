import _ from 'lodash';
import { TransactionType } from 'src/constants';
import { AccountService, NamespaceService, TransactionService } from 'src/services';
import { PersistentStorage } from 'src/storage';
import {
    filterAllowedTransactions,
    filterBlacklistedTransactions,
    isSymbolAddress,
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
            const [partialPage, unconfirmedPage, confirmedPage] = await Promise.all([
                TransactionService.fetchAccountTransactions(current, networkProperties, { group: 'partial', filter }),
                TransactionService.fetchAccountTransactions(current, networkProperties, { group: 'unconfirmed', filter }),
                TransactionService.fetchAccountTransactions(current, networkProperties, { group: 'confirmed', filter }),
            ]);

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
            const pageSize = 15;
            const confirmedPage = await TransactionService.fetchAccountTransactions(current, networkProperties, {
                group: 'confirmed',
                filter,
                pageNumber,
                pageSize
            });
            const isLastPage = confirmedPage.length === 0 || confirmedPage.length < pageSize;

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
        sendTransferTransaction: async ({ state }, { transaction }) => {
            const { networkProperties } = state.network;
            const currentAccount = state.account.current;

            // TODO: Remove
            const preparedTransaction = {
                type: transaction.type,
                signerPublicKey: currentAccount.publicKey,
                mosaics: transaction.mosaics,
                message: transaction.message,
                fee: transaction.fee,
            };
            const isMultisigTransaction = !!transaction.sender;
            const recipient = transaction.recipientAddress || transaction.recipient;

            // Resolve recipient address
            if (isSymbolAddress(recipient)) {
                preparedTransaction.recipientAddress = recipient;
            } else {
                preparedTransaction.recipientAddress = await NamespaceService.namespaceNameToAddress(
                    networkProperties,
                    recipient.toLowerCase()
                );
            }

            // If message is encrypted, fetch recipient publicKey
            if (transaction.message?.isEncrypted) {
                const recipientAccount = await AccountService.fetchAccountInfo(
                    networkProperties,
                    preparedTransaction.recipientAddress
                );
                preparedTransaction.recipientPublicKey = recipientAccount.publicKey;
            }

            // If transaction is multisig, announce Aggregate Bonded
            if (isMultisigTransaction) {
                const senderAccount = await AccountService.fetchAccountInfo(networkProperties, transaction.sender);
                preparedTransaction.signerPublicKey = senderAccount.publicKey;

                const aggregateTransaction = {
                    type: TransactionType.AGGREGATE_BONDED,
                    signerPublicKey: currentAccount.publicKey,
                    fee: transaction.fee,
                    innerTransactions: [preparedTransaction]
                }

                await TransactionService.signAndAnnounce(aggregateTransaction, networkProperties, currentAccount);
            }

            // Else, announce Transfer
            await TransactionService.signAndAnnounce(preparedTransaction, networkProperties, currentAccount);
        },
    },
};
