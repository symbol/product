import { buildAssetsSections, getAssetsFilterConfig } from '../utils';
import { useAsyncManager, useInit, useLoading, useReactiveWalletControllers, useTransactionListener, useWalletListener } from '@/app/hooks';
import { walletControllers as controllers } from '@/app/lib/controller';
import { useMemo, useState } from 'react';

/**
 * @typedef {Object} AssetsData
 * @property {Array} sections - Sections for SectionList
 * @property {object} filter - Current filter values
 * @property {function} setFilter - Function to update filter
 * @property {Array} filterConfig - Filter configuration
 * @property {boolean} isLoading - Whether initial loading is in progress
 * @property {boolean} isRefreshing - Whether refresh is in progress
 * @property {boolean} isLastPage - Whether the last page has been reached
 * @property {function} refresh - Function to refresh all data
 */

/**
 * Main hook for the Assets screen. Builds asset sections,
 * manages filter state, and refreshes account data on wallet events.
 *
 * @returns {AssetsData} Assets data and controls
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
