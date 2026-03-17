import { usePagination, useWalletController } from '@/app/hooks';
import { showError } from '@/app/utils';
import { useCallback, useRef } from 'react';

const FIRST_PAGE_NUMBER = 1;
const PAGE_SIZE = 15;

/**
 * @typedef {Object} UseReceiptHistoryResult
 * @property {Object[]} receipts - Harvested receipts/blocks.
 * @property {boolean} isLoading - Whether initial loading is in progress.
 * @property {boolean} isPageLoading - Whether next page is loading.
 * @property {boolean} isLastPage - Whether the last page has been reached.
 * @property {function(): void} refresh - Function to refresh all data.
 * @property {function(): void} resetAndRefresh - Function to reset and refresh all data.
 * @property {function(): void} fetchNextPage - Function to fetch the next page.
 */

/**
 * React hook for managing harvested blocks/receipts history with pagination.
 *
 * @returns {UseReceiptHistoryResult} Receipt history state and controls.
 */
export const useReceiptHistory = () => {
	const walletController = useWalletController();
	const { currentAccount } = walletController;
	
	// Track the account we're fetching for
	const requestedAccountPublicKey = useRef(null);

	// Pagination for harvested blocks
	const pagination = usePagination({
		callback: async ({ pageNumber }) => {
			const data = await walletController.modules.harvesting.fetchAccountHarvestedBlocks({
				pageNumber
			});
			
			// Skip if account changed
			if (requestedAccountPublicKey.current !== currentAccount.publicKey)
				return [];

			return data;
		},
		pageSize: PAGE_SIZE,
		firstPageNumber: FIRST_PAGE_NUMBER,
		onError: showError
	});

	// Refresh harvested data
	const refresh = useCallback(() => {
		requestedAccountPublicKey.current = currentAccount.publicKey;
		pagination.fetchFirstPage();
	}, [currentAccount?.publicKey, pagination]);

	const resetAndRefresh = useCallback(() => {
		pagination.reset();
		refresh();
	}, [pagination, refresh]);

	return {
		receipts: pagination.data,
		isLoading: pagination.isLoading && pagination.pageNumber === FIRST_PAGE_NUMBER,
		isPageLoading: pagination.isLoading && pagination.pageNumber > FIRST_PAGE_NUMBER,
		isLastPage: pagination.isLastPage,
		pageNumber: pagination.pageNumber,
		refresh,
		resetAndRefresh,
		fetchNextPage: pagination.fetchNextPage
	};
};
