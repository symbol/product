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
	const [filter, setFilter] = useState({});
	const [isLoading, setIsLoading] = useState(false);
	const [isLastPage, setIsLastPage] = useState(false);
	const [pageNumber, setPageNumber] = useState(1);
	const [data, setData] = useState(defaultData);

	const call = (pageNumber, filter) => {
		setIsLoading(true);
		setTimeout(async () => {
			try {
				const { data, pageNumber: currentPageNumber } = await callback({ pageNumber: pageNumber, ...filter});

				if (currentPageNumber === pageNumber) {
					setData(v => [...v, ...data]);
					setPageNumber(currentPageNumber);
					setIsLastPage(data.length === 0);
				}
			} catch (error) {
				// eslint-disable-next-line no-console
				onError('[Pagination] Error:', error);
			}
			setIsLoading(false);
		});
	};

	const requestNextPage = () => {
		const nextPageNumber = pageNumber + 1;
		call(nextPageNumber, filter);
	}

	const changeFilter = (filter) => {
		setData([]);
		setPageNumber(0);
		setFilter(filter);
		call(1, filter);
	}

	return { requestNextPage, data, isLoading, pageNumber, isLastPage, filter, changeFilter };
};

export const useDelayedCall = (callback) => {
	const [timer, setTimer] = useState(setTimeout(() => {}));
	const delay = 750;

	const call = (...args) => {
		if (timer)
			clearTimeout(timer);

		const newTimer = setTimeout(() => callback(...args), delay);
		setTimer(newTimer);
	};

	return [call];
}
