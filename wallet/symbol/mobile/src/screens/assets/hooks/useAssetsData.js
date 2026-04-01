import { buildAssetsSections, getAssetsFilterConfig } from '../utils';
import { useAsyncManager, useInit, useLoading, useReactiveWalletControllers, useTransactionListener, useWalletListener } from '@/app/hooks';
import { walletControllers as controllers } from '@/app/lib/controller';
import { useMemo, useState } from 'react';

/** @typedef {import('@/app/types/Filter').FilterItem} FilterItem */
/** @typedef {import('@/app/types/Filter').FilterValue} FilterValue */
/** @typedef {import('@/app/screens/assets/types/Assets').AssetSection} AssetSection */

/**
 * @typedef {Object} UseAssetsDataReturnType
 * @property {AssetSection[]} sections - Asset sections for SectionList
 * @property {FilterValue} filter - Current filter values
 * @property {function(FilterValue): void} setFilter - Function to update filter
 * @property {FilterItem[]} filterConfig - Filter configuration array
 * @property {boolean} isLoading - Whether initial loading is in progress
 * @property {boolean} isRefreshing - Whether refresh is in progress
 * @property {boolean} isLastPage - Whether the last page has been reached
 * @property {function(): void} refresh - Function to refresh all data
 */

/**
 * React hook that manages assets screen state.
 * Builds asset sections, manages filter state, and refreshes account data on wallet events.
 * @returns {UseAssetsDataReturnType} Assets data and controls
 */
export const useAssetsData = () => {
	const walletControllers = useReactiveWalletControllers([controllers.main, ...controllers.additional]);

	// Filter
	const [filter, setFilter] = useState({});
	const filterConfig = useMemo(() => getAssetsFilterConfig(), []);

	// Build sections
	const sections = buildAssetsSections({ walletControllers, filter });

	// Data fetching
	const dataManager = useAsyncManager({
		callback: async () => {
			await Promise.all(walletControllers
				.filter(controller => controller.currentAccount && controller.isWalletReady)
				.map(controller => controller.fetchAccountInfo()));
		}
	});
	useTransactionListener({
		walletControllers,
		onTransactionConfirmed: dataManager.call
	});
	useWalletListener({
		walletControllers,
		onAccountChange: dataManager.call
	});
	useInit(() => {
		dataManager.call();
	}, controllers.main.isWalletReady);

	// Determine loading states
	const [isLoading, isRefreshing] = useLoading(dataManager.isLoading);

	return {
		sections,
		filter,
		setFilter,
		filterConfig,
		isLoading,
		isRefreshing,
		isLastPage: true,
		refresh: dataManager.call
	};
};
