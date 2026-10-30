import { buildAssetsSections, getAssetsFilterConfig } from '../utils';
import { useAsyncManager, useReactiveWalletControllers } from '@/app/hooks';
import { walletControllers as controllers } from '@/app/lib/controller';
import { useCallback, useMemo, useState } from 'react';

/** @typedef {import('@/app/types/Filter').FilterItem} FilterItem */
/** @typedef {import('@/app/types/Filter').FilterValue} FilterValue */
/** @typedef {import('@/app/screens/assets/types/Assets').AssetSection} AssetSection */

/**
 * Return type of the useAssetsData hook.
 * @typedef {object} UseAssetsDataReturnType
 * @property {AssetSection[]} sections - Asset sections for SectionList.
 * @property {FilterValue} filter - Current filter values.
 * @property {function(FilterValue): void} setFilter - Function to update filter.
 * @property {FilterItem[]} filterConfig - Filter configuration array.
 * @property {boolean} isLoading - Whether loading is in progress.
 * @property {function(): void} load - Function to load all data.
 * @property {function(): void} reset - Function to reset data state.
 */

/**
 * React hook that manages assets screen state.
 * Builds asset sections, manages filter state, and provides data fetching.
 * @returns {UseAssetsDataReturnType} Assets data and controls.
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

	const load = useCallback(() => {
		dataManager.call();
	}, [dataManager]);

	const reset = useCallback(() => {
		dataManager.reset();
	}, [dataManager]);

	return {
		sections,
		filter,
		setFilter,
		filterConfig,
		isLoading: dataManager.isLoading,
		load,
		reset
	};
};
