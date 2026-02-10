import { useReceiptHistory } from './useReceiptHistory';
import { useTransactionHistory } from './useTransactionHistory';
import { SectionType, buildHistorySections, getHistoryFilterConfig } from '../utils';
import { TransactionGroup } from '@/app/constants';
import { useInit, useLoading, useTransactionListener } from '@/app/hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * @typedef {Object} HistoryData
 * @property {Array} sections - Sections for SectionList
 * @property {object} filter - Current filter values
 * @property {function} setFilter - Function to update filter
 * @property {Array} filterConfig - Filter configuration
 * @property {boolean} isLoading - Whether initial loading is in progress
 * @property {boolean} isRefreshing - Whether refresh is in progress
 * @property {boolean} isPageLoading - Whether next page is loading
 * @property {boolean} isLastPage - Whether the last page has been reached
 * @property {function} refresh - Function to refresh all data
 * @property {function} fetchNextPage - Function to fetch the next page
 * @property {function} shouldShowFooter - Function to check if footer should show for section
 */

/**
 * Main hook for the History screen. Combines transaction and receipt history,
 * manages filter state, and handles data refresh on wallet events.
 * @param {object} params - Hook parameters
 * @param {import('wallet-common-core').WalletController} params.walletController - Wallet controller instance
 *
 * @returns {HistoryData} History data and controls
 */
export const useHistoryData = ({ walletController }) => {
	const { isWalletReady, currentAccount } = walletController;

	// Filter
	const [filter, setFilter] = useState({});
	const filterConfig = useMemo(() => getHistoryFilterConfig(), []);
	const isHarvestedMode = !!filter.harvested;

	// Histories
	const transactionHistory = useTransactionHistory({ filter });
	const receiptHistory = useReceiptHistory();

	const selectedHistory = useMemo(() => (
		isHarvestedMode ? receiptHistory : transactionHistory
	), [isHarvestedMode, transactionHistory, receiptHistory]);

	useInit(selectedHistory.resetAndRefresh, isWalletReady, [currentAccount?.publicKey, filter]);

	// Listen for transaction events
	useTransactionListener({
		walletControllers: [walletController],
		onTransactionUnconfirmed: selectedHistory.refresh,
		onTransactionPartial: selectedHistory.refresh,
		onTransactionConfirmed: selectedHistory.refresh,
		deps: [walletController, selectedHistory.refresh]
	});

	// Build sections
	const sections = useMemo(() => buildHistorySections({
		partial: transactionHistory.partial,
		unconfirmed: transactionHistory.unconfirmed,
		confirmed: transactionHistory.confirmed,
		harvested: receiptHistory.receipts,
		isHarvestedMode
	}), [
		transactionHistory.partial,
		transactionHistory.unconfirmed,
		transactionHistory.confirmed,
		receiptHistory.receipts,
		isHarvestedMode
	]);

	// Determine loading states
	const {isPageLoading} = selectedHistory;
	const {isLastPage} = selectedHistory;
	const [isLoading, isRefreshing] = useLoading(selectedHistory.isLoading);

	// Fetch next page if it was requested while loading
	const [isNextPageRequested, setIsNextPageRequested] = useState(false);
	const canFetchNextPage = isWalletReady && !isPageLoading && !isLoading;

	const fetchNextPage = () => {
		if (!canFetchNextPage) {
			setIsNextPageRequested(true);
			return;
		}

		selectedHistory.fetchNextPage();
	};
	
	useEffect(() => {
		if (canFetchNextPage && isNextPageRequested) {
			fetchNextPage();
			setIsNextPageRequested(false);
		}
	}, [canFetchNextPage, isNextPageRequested]);

	// Check if footer should show for a section
	const shouldShowFooter = useCallback(group => {
		if (isHarvestedMode)
			return group === SectionType.RECEIPTS && !isLastPage;

		return group === TransactionGroup.CONFIRMED && !isLastPage;
	}, [isHarvestedMode, isLastPage]);

	return {
		sections,
		filter,
		setFilter,
		filterConfig,
		isLoading,
		isRefreshing,
		isPageLoading,
		isLastPage,
		refresh: selectedHistory.refresh,
		fetchNextPage,
		shouldShowFooter
	};
};
