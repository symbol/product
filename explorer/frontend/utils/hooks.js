import { STORAGE_KEY } from '@/constants';
import { useEffect, useState } from 'react';

export const useDataManager = (callback, defaultData, onError, loadingState = false) => {
	const [isLoading, setIsLoading] = useState(loadingState);
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
				const { data, pageNumber: currentPageNumber } = await callback({ pageNumber: pageNumber, ...filter });

				if (currentPageNumber === pageNumber) {
					setData(v => [...v, ...data]);
					setPageNumber(currentPageNumber);
					setIsLastPage(data.length === 0);
				}
			} catch (error) {
				// eslint-disable-next-line no-console
				console.error('[Pagination] Error:', error);
			}
			setIsLoading(false);
		});
	};

	const requestNextPage = () => {
		const nextPageNumber = pageNumber + 1;
		call(nextPageNumber, filter);
	};

	const changeFilter = filter => {
		setData([]);
		setPageNumber(0);
		setFilter(filter);
		call(1, filter);
	};

	return { requestNextPage, data, isLoading, pageNumber, isLastPage, filter, changeFilter };
};

export const useFilter = (callback, defaultData, initialCall) => {
	const [filter, setFilter] = useState({});
	const [isLoading, setIsLoading] = useState(false);
	const [data, setData] = useState(defaultData);

	const call = filter => {
		setIsLoading(true);
		setTimeout(async () => {
			try {
				const data = await callback({ ...filter });
				setData(data);
			} catch (error) {
				// eslint-disable-next-line no-console
				console.error('[Filter] Error:', error);
			}
			setIsLoading(false);
		});
	};

	const changeFilter = filter => {
		setData(defaultData);
		setFilter(filter);
		call(filter);
	};

	useEffect(() => {
		if (initialCall) {
			call(filter);
		}
	}, [initialCall]);

	return { data, isLoading, filter, changeFilter };
};

export const useClientSideFilter = data => {
	const [filter, setFilter] = useState({});
	const filteredData = data.filter(item => Object.keys(filter).every(filterKey => item[filterKey] === filter[filterKey]));

	return {
		data: filteredData,
		filter,
		changeFilter: setFilter
	};
};

export const useDelayedCall = callback => {
	const [timer, setTimer] = useState(setTimeout(() => {}));
	const delay = 750;

	const call = (...args) => {
		if (timer) clearTimeout(timer);

		const newTimer = setTimeout(() => callback(...args), delay);
		setTimer(newTimer);
	};

	return [call];
};

export const useToggle = initialValue => {
	const [value, setValue] = useState(initialValue);

	const toggle = () => setValue(value => !value);

	return [value, toggle];
};

export const useStorage = (key, defaultValue, callback) => {
	const [value, setValue] = useState(defaultValue);
	const [setter, setSetter] = useState(null);
	const getEvent = key => `storage.update.${key}`;
	const storage = {
		[STORAGE_KEY.ADDRESS_BOOK]: {
			get: () => {
				const defaultValue = [];

				try {
					const jsonString = localStorage.getItem(STORAGE_KEY.ADDRESS_BOOK);
					return JSON.parse(jsonString) || defaultValue;
				} catch {
					return defaultValue;
				}
			},
			set: value => {
				localStorage.setItem(STORAGE_KEY.ADDRESS_BOOK, JSON.stringify(value));
				dispatchEvent(new Event(getEvent(STORAGE_KEY.ADDRESS_BOOK)));
			}
		},
		[STORAGE_KEY.TIMESTAMP_TYPE]: {
			get: () => {
				const defaultValue = 'UTC';

				try {
					const value = localStorage.getItem(STORAGE_KEY.TIMESTAMP_TYPE);
					return value || defaultValue;
				} catch {
					return defaultValue;
				}
			},
			set: value => {
				localStorage.setItem(STORAGE_KEY.TIMESTAMP_TYPE, value);
				dispatchEvent(new Event(getEvent(STORAGE_KEY.TIMESTAMP_TYPE)));
			}
		}
	};

	useEffect(() => {
		const accessor = storage[key];

		if (!accessor) {
			throw Error(`Failed to access store. Unknown key "${key}"`);
		}

		const updateValue = () => {
			const value = accessor.get();
			setValue(value);
			if (callback) {
				callback(value);
			}
		};

		setSetter(() => accessor.set);
		updateValue();
		window?.addEventListener(getEvent(key), updateValue);

		return () => {
			window?.removeEventListener(getEvent(key), updateValue);
		};
	}, []);

	return [value, setter];
};
