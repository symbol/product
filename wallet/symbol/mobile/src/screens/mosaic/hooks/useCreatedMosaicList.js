import { buildCreatedMosaicListSections, filterCreatedMosaics, getCreatedMosaicListFilterConfig, mergeHeldAmounts } from '../utils';
import { usePagination } from '@/app/hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';

/** @typedef {import('@/app/types/Filter').FilterItem} FilterItem */
/** @typedef {import('@/app/types/Filter').FilterValue} FilterValue */
/** @typedef {import('@/app/types/Wallet').MainWalletController} MainWalletController */
/** @typedef {import('@/app/screens/mosaic/types/Mosaic').CreatedMosaicSection} CreatedMosaicSection */

const FIRST_PAGE_NUMBER = 1;
const PAGE_SIZE = 15;
// Visible-item count below which further pages are fetched to keep the list filled
const AUTO_FILL_MIN_ITEMS = 10;

/**
 * Return type for useCreatedMosaicList hook.
 * @typedef {object} UseCreatedMosaicListReturnType
 * @property {CreatedMosaicSection[]} sections - List sections holding the created mosaics, narrowed by the active filter.
 * @property {FilterItem[]} filterConfig - Filter configuration array.
 * @property {FilterValue} filter - Current filter values.
 * @property {function(FilterValue): void} setFilter - Function to update filter.
 * @property {function(): void} load - Function to fetch the first page, replacing loaded data.
 * @property {function(): void} reset - Function to reset the list state.
 * @property {function(): void} fetchNextPage - Function to fetch the next page.
 * @property {boolean} isLoading - Whether the first page is being fetched.
 * @property {boolean} isPageLoading - Whether a next page is being fetched.
 * @property {boolean} isLastPage - Whether the last page has been reached.
 */

/**
 * React hook that manages the paginated list of mosaics created by the current account, with held
 * balances merged in. Auto-fetches further pages while the filtered list stays under-filled.
 * @param {MainWalletController} walletController - The wallet controller instance.
 * @returns {UseCreatedMosaicListReturnType} The created mosaic list state and controls.
 */
export const useCreatedMosaicList = walletController => {
	const mosaicModule = walletController.modules.mosaic;
	const { currentAccount, currentAccountInfo, networkProperties } = walletController;
	const heldMosaics = currentAccountInfo?.tokens ?? currentAccountInfo?.mosaics ?? [];

	// Filter
	const [filter, setFilter] = useState({});
	const filterConfig = useMemo(() => getCreatedMosaicListFilterConfig(), []);

	// Data fetching
	const pagination = usePagination({
		callback: ({ pageNumber, pageSize }) => mosaicModule.fetchAccountMosaics(currentAccount.address, { pageNumber, pageSize }),
		pageSize: PAGE_SIZE,
		firstPageNumber: FIRST_PAGE_NUMBER,
		defaultData: []
	});

	// List controls
	const load = useCallback(() => {
		pagination.fetchFirstPage().catch(() => {}); // errors are reported by the async manager
	}, [pagination]);

	const reset = useCallback(() => {
		pagination.reset();
	}, [pagination]);

	const fetchNextPage = useCallback(() => {
		pagination.fetchNextPage().catch(() => {});
	}, [pagination]);

	// Derived display list
	const mosaics = filterCreatedMosaics(mergeHeldAmounts(pagination.data, heldMosaics), filter, networkProperties.chainHeight);
	const sections = buildCreatedMosaicListSections(mosaics);

	// The page number advances only after a successful fetch, so it also signals that the first page is in
	const hasLoadedFirstPage = pagination.pageNumber > FIRST_PAGE_NUMBER;
	const isUnderFilled = hasLoadedFirstPage && mosaics.length < AUTO_FILL_MIN_ITEMS;

	// Filters and hidden expired mosaics narrow the fetched pages, so keep pulling until the list fills up
	useEffect(() => {
		if (isUnderFilled && !pagination.isLastPage && !pagination.isLoading)
			fetchNextPage();
	}, [isUnderFilled, pagination.isLastPage, pagination.isLoading, fetchNextPage]);

	return {
		sections,
		filterConfig,
		filter,
		setFilter,
		load,
		reset,
		fetchNextPage,
		isLoading: pagination.isLoading && !hasLoadedFirstPage,
		isPageLoading: pagination.isLoading && hasLoadedFirstPage,
		isLastPage: pagination.isLastPage
	};
};
