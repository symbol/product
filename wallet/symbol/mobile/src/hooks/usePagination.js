import { useAsyncManager } from '@/app/hooks';
import { useCallback, useState } from 'react';

const defaultDataUpdater = (prevData, newData) => [...prevData, ...newData];

/**
 * React hook for managing pagination with asynchronous data fetching.
 * @template T The type of data items in the array.
 * 
 * @param {object} config - The configuration object for the hook.
 * @param {function({pageNumber: number, pageSize: number}): Promise<T[]>} config.callback - The asynchronous callback 
 * function to fetch data for a page.
 * @param {T[]} [config.defaultData=[]] - The default data array.
 * @param {function(*)} [config.onError=null] - An optional error handler function called on error.
 * @param {number|null} [config.pageSize=null] - The number of items per page. Used to determine the last page.
 * @param {number} [config.firstPageNumber=1] - The starting page number.
 * @param {function(T[], T[]): T[]} [config.dataUpdater=defaultDataUpdater] - Function to update data with new page data.
 * @param {boolean} [config.defaultLoadingState=false] - The default loading state.
 * @returns {object} An object containing pagination state and control functions.
 * @property {boolean} isLoading - Whether a fetch operation is in progress.
 * @property {boolean} isLastPage - Whether the last page has been reached.
 * @property {number} pageNumber - The current page number.
 * @property {T[]} data - The accumulated data from all fetched pages.
 * @property {*} error - The error from the last failed fetch, if any.
 * @property {function(): Promise<void>} fetchNextPage - Function to fetch the next page of data.
 * @property {function(T[]): void} setData - Function to manually set the data.
 * @property {function(): void} reset - Function to reset the pagination state.
 */
export const usePagination = ({
	callback,
	defaultData,
	onError = null,
	pageSize = null,
	firstPageNumber = 1,
	dataUpdater = defaultDataUpdater,
	defaultLoadingState = false
}) => {
	const [pageNumber, setPageNumber] = useState(firstPageNumber);
	const [isLastPage, setIsLastPage] = useState(false);
	const [data, setData] = useState(defaultData);

	const asyncManager = useAsyncManager({
		callback: async page => await callback({ pageNumber: page, pageSize }),
		defaultData: defaultData ?? [],
		defaultLoadingState,
		onError
	});

	const fetchPage = async (pageNumber, shouldReplaceData) => {
		const pageData = await asyncManager.call(pageNumber);

		setPageNumber(prev => prev + 1);
		setData(prevData => dataUpdater(shouldReplaceData ? [] : prevData, pageData));

		const isPageEmpty = pageData.length === 0;
		const isPageIncomplete = pageSize !== null && pageData.length < pageSize;

		if (isPageEmpty || isPageIncomplete)
			setIsLastPage(true);

		return pageData;
	};

	const fetchNextPage = useCallback(async () => {
		if (asyncManager.isLoading || isLastPage)
			return;

		return fetchPage(pageNumber);
	}, [asyncManager, pageNumber, isLastPage, pageSize, dataUpdater]);

	const fetchFirstPage = useCallback(async () => {
		if (asyncManager.isLoading)
			return;

		// Reset state before fetching first page
		setPageNumber(firstPageNumber);
		setIsLastPage(false);
		asyncManager.reset();

		return fetchPage(firstPageNumber, true);
	}, [asyncManager, firstPageNumber, isLastPage, defaultData, pageSize, dataUpdater]);

	const reset = useCallback(() => {
		setPageNumber(firstPageNumber);
		setData(defaultData ?? []);
		setIsLastPage(false);
		asyncManager.reset();
	}, [firstPageNumber, defaultData, asyncManager]);

	const updateData = useCallback(newData => {
		setData(newData);
	}, []);

	return {
		isLoading: asyncManager.isLoading,
		isLastPage,
		pageNumber,
		data,
		error: asyncManager.error,
		fetchFirstPage,
		fetchNextPage,
		setData: updateData,
		reset
	};
};
