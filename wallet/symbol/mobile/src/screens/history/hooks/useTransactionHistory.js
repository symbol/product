import { TransactionGroup } from '@/app/constants';
import { useAsyncManager, usePagination, useWalletController } from '@/app/hooks';
import { showError } from '@/app/utils';
import { uniqBy } from 'lodash';
import { useCallback, useMemo, useRef, useState } from 'react';
import { removeAllowedTransactions, removeBlockedTransactions } from 'wallet-common-symbol';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */

const FIRST_PAGE_NUMBER = 1;
const PAGE_SIZE = 15;

/**
 * Filters transactions based on blacklist settings.
 * @param {Transaction[]} transactions - Transactions to filter.
 * @param {Object[]} blackList - Address blacklist.
 * @param {boolean} showBlocked - Whether to show blocked transactions only.
 * @returns {Transaction[]} Filtered transactions.
 */
const filterByBlacklist = (transactions, blackList, showBlocked) => {
	if (!transactions) 
		return [];

	return showBlocked
		? removeAllowedTransactions(transactions, blackList)
		: removeBlockedTransactions(transactions, blackList);
};

/**
 * Merges new transactions with existing ones, removing duplicates.
 * @param {Transaction[]} existing - Existing transactions.
 * @param {Transaction[]} incoming - New transactions.
 * @returns {Transaction[]} Merged transactions.
 */
const mergeTransactions = (existing, incoming) => uniqBy([...existing, ...incoming], 'hash');

/**
 * @typedef {Object} UseTransactionHistoryResult
 * @property {Transaction[]} confirmed - Confirmed transactions.
 * @property {Transaction[]} unconfirmed - Unconfirmed transactions.
 * @property {Transaction[]} partial - Partial transactions.
 * @property {boolean} isLoading - Whether initial loading is in progress.
 * @property {boolean} isPageLoading - Whether next page is loading.
 * @property {boolean} isLastPage - Whether the last page has been reached.
 * @property {function(): void} refresh - Function to refresh all data.
 * @property {function(): void} resetAndRefresh - Function to reset and refresh all data.
 * @property {function(): void} fetchNextPage - Function to fetch the next page.
 */

/**
 * React hook for managing transaction history with pagination and filtering.
 * Handles fetching confirmed, unconfirmed, and partial transactions.
 *
 * @param {Object} options - Hook options.
 * @param {Object} options.filter - Current filter values.
 * @returns {UseTransactionHistoryResult} Transaction history state and controls.
 */
export const useTransactionHistory = ({ filter }) => {
	const walletController = useWalletController();
	const { currentAccount, currentAccountLatestTransactions } = walletController;
	
	// Track the account we're fetching for (to handle account changes during fetch)
	const requestedAccountPublicKey = useRef(null);

	// State for unconfirmed and partial (not paginated)
	const [unconfirmed, setUnconfirmed] = useState({});
	const [partial, setPartial] = useState({});

	// Get blacklist
	const blackList = useMemo(
		() => walletController.modules.addressBook.blackList ?? [],
		[walletController.modules.addressBook.blackList]
	);

	// Pagination for confirmed transactions
	const confirmedPagination = usePagination({
		callback: async ({ pageNumber }) => {
			const searchCriteria = {
				pageNumber,
				pageSize: PAGE_SIZE,
				group: TransactionGroup.CONFIRMED,
				filter
			};
			
			const data = await walletController.fetchAccountTransactions(searchCriteria);
			
			// Skip if account changed
			if (requestedAccountPublicKey.current !== currentAccount.publicKey)
				return [];

			return filterByBlacklist(data, blackList, filter.blocked);
		},
		pageSize: PAGE_SIZE,
		firstPageNumber: FIRST_PAGE_NUMBER,
		defaultData: filterByBlacklist(currentAccountLatestTransactions, blackList, filter.blocked),
		dataUpdater: mergeTransactions,
		onError: showError
	});

	// Fetch unconfirmed and partial transactions (only on first page)
	const pendingTransactionsManager = useAsyncManager({
		callback: async () => {
			const [unconfirmedData, partialData] = await Promise.all([
				walletController.fetchAccountTransactions({ 
					group: TransactionGroup.UNCONFIRMED,
					filter
				}),
				walletController.fetchAccountTransactions({ 
					group: TransactionGroup.PARTIAL,
					filter
				})
			]);

			// Skip if account changed
			if (requestedAccountPublicKey.current !== currentAccount.publicKey) {
				return { 
					accountPublicKey: requestedAccountPublicKey.current,
					unconfirmed: [], 
					partial: [] 
				};
			}

			return {
				accountPublicKey: requestedAccountPublicKey.current,
				unconfirmed: filterByBlacklist(unconfirmedData, blackList, filter.blocked),
				partial: filterByBlacklist(partialData, blackList, filter.blocked)
			};
		},
		onSuccess: data => {
			setUnconfirmed(prev => ({ ...prev, [data.accountPublicKey]: data.unconfirmed }));
			setPartial(prev => ({ ...prev, [data.accountPublicKey]: data.partial }));
		},
		onError: showError
	});

	// Refresh all transaction data
	const refresh = useCallback(() => {
		requestedAccountPublicKey.current = currentAccount.publicKey;
		
		// Fetch fresh data
		confirmedPagination.fetchFirstPage();
		pendingTransactionsManager.call();
	}, [
		currentAccount?.publicKey,
		currentAccountLatestTransactions,
		blackList,
		filter.blocked,
		confirmedPagination,
		pendingTransactionsManager
	]);
	const resetAndRefresh = useCallback(() => {
		confirmedPagination.reset();
		refresh();
	}, [confirmedPagination.reset, refresh]);

	return {
		confirmed: confirmedPagination.data,
		unconfirmed: unconfirmed[currentAccount.publicKey] ?? [],
		partial: partial[currentAccount.publicKey] ?? [],
		isLoading: confirmedPagination.isLoading && confirmedPagination.pageNumber === FIRST_PAGE_NUMBER,
		isPageLoading: confirmedPagination.isLoading && confirmedPagination.pageNumber > FIRST_PAGE_NUMBER,
		isLastPage: confirmedPagination.isLastPage,
		pageNumber: confirmedPagination.pageNumber,
		refresh,
		resetAndRefresh,
		fetchNextPage: confirmedPagination.fetchNextPage
	};
};
