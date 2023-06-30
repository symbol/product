import { useState } from 'react';

export const useDataManager = (callback, defaultData, onError) => {
	const [isLoading, setIsLoading] = useState(false);
	const [data, setData] = useState(defaultData);

	const call = (...args) => {
		setIsLoading(true);
		setTimeout(async () => {
			try {
				const data = await callback(...args);
				setData(data);
			} catch (error) {
				if (onError) {
					// eslint-disable-next-line no-console
					onError('[Data Manager] Error:', error);
				}
			}
			setIsLoading(false);
		});
	};

	return [call, isLoading, data];
};

export const usePagination = (callback, defaultData) => {
	const [isLoading, setIsLoading] = useState(false);
	const [isLastPage, setIsLastPage] = useState(false);
	const [pageNumber, setPageNumber] = useState(1);
	const [data, setData] = useState(defaultData);

	const call = (...args) => {
		setIsLoading(true);
		setTimeout(async () => {
			try {
				const { data, pageNumber: nextPageNumber } = await callback(...args);

				if (nextPageNumber > pageNumber) {
					setData(v => [...v, ...data]);
					setPageNumber(nextPageNumber);
					setIsLastPage(data.length === 0);
				}
			} catch (error) {
				// eslint-disable-next-line no-console
				onError('[Pagination] Error:', error);
			}
			setIsLoading(false);
		});
	};

	return [call, data, isLoading, pageNumber, isLastPage];
};
