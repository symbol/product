import { useAsyncManager } from '@/app/hooks';
import { useCallback, useState } from 'react';

/** @typedef {import('@/app/types/Pagination').PageCursor} PageCursor */
/**
 * @template T
 * @typedef {import('@/app/types/Pagination').Page<T>} Page
 */

const defaultDataUpdater = (prevData, newData) => [...prevData, ...newData];

/**
 * React hook for managing pagination with asynchronous data fetching.
 * @template T The type of data items in the array.
 *
 * @param {object} config - The configuration object for the hook.
 * @param {function({cursor: PageCursor|null, pageSize: number|null}): Promise<Page<T>>} config.callback - The asynchronous callback
 * function to fetch a page.
 * @param {T[]} [config.defaultData=[]] - The default data array.
 * @param {function(*)} [config.onError=null] - An optional error handler function called on error.
 * @param {number|null} [config.pageSize=null] - The number of items per page. Passed to the callback.
 * @param {function(T[], T[]): T[]} [config.dataUpdater=defaultDataUpdater] - Function to update data with new page data.
 * @param {boolean} [config.defaultLoadingState=false] - The default loading state.
 * @returns {object} An object containing pagination state and control functions.
 * @property {boolean} isLoading - Whether a fetch operation is in progress.
 * @property {boolean} isLastPage - Whether the last page has been reached.
 * @property {number} loadedPageCount - The number of pages successfully fetched (the last fetched page number).
 * @property {T[]} data - The accumulated data from all fetched pages.
 * @property {*} error - The error from the last failed fetch, if any.
 * @property {function(): Promise<void>} fetchFirstPage - Function to fetch the first page, replacing the loaded data.
 * @property {function(): Promise<void>} fetchNextPage - Function to fetch the next page of data.
 * @property {function(T[]): void} setData - Function to manually set the data.
 * @property {function(): void} reset - Function to reset the pagination state.
 */
export const usePagination = ({
	callback,
	defaultData,
	onError = null,
	pageSize = null,
	dataUpdater = defaultDataUpdater,
	defaultLoadingState = false
}) => {
	const [nextCursor, setNextCursor] = useState(null);
	const [loadedPageCount, setLoadedPageCount] = useState(0);
	const [isLastPage, setIsLastPage] = useState(false);
	const [data, setData] = useState(defaultData);

	const asyncManager = useAsyncManager({
		callback: async cursor => await callback({ cursor, pageSize }),
		defaultData: { data: defaultData ?? [], nextCursor: null },
		defaultLoadingState,
		onError
	});

	const fetchPage = async (cursor, shouldReplaceData) => {
		const page = await asyncManager.call(cursor);

		setNextCursor(page.nextCursor);
		setIsLastPage(page.nextCursor === null);
		setLoadedPageCount(prevCount => prevCount + 1);
		setData(prevData => dataUpdater(shouldReplaceData ? [] : prevData, page.data));

		return page.data;
	};

	const fetchNextPage = useCallback(async () => {
		if (asyncManager.isLoading || isLastPage)
			return;

		return fetchPage(nextCursor);
	}, [asyncManager, nextCursor, isLastPage, pageSize, dataUpdater]);

	const fetchFirstPage = useCallback(async () => {
		if (asyncManager.isLoading)
			return;

		// Reset state before fetching first page
		setNextCursor(null);
		setLoadedPageCount(0);
		setIsLastPage(false);
		asyncManager.reset();

		return fetchPage(null, true);
	}, [asyncManager, isLastPage, defaultData, pageSize, dataUpdater]);

	const reset = useCallback(() => {
		setNextCursor(null);
		setLoadedPageCount(0);
		setData(defaultData ?? []);
		setIsLastPage(false);
		asyncManager.reset();
	}, [defaultData, asyncManager]);

	const updateData = useCallback(newData => {
		setData(newData);
	}, []);

	return {
		isLoading: asyncManager.isLoading,
		isLastPage,
		loadedPageCount,
		data,
		error: asyncManager.error,
		fetchFirstPage,
		fetchNextPage,
		setData: updateData,
		reset
	};
};
