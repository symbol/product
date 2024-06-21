import { STORAGE_KEY } from '@/constants';
import _ from 'lodash';
import { useEffect, useState } from 'react';

// Makes an async call. Handles the loading and error states.
export const useDataManager = (callback, defaultData, onError, defaultLoadingState = false) => {
	const [isLoading, setIsLoading] = useState(defaultLoadingState);
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
					onError(error);
				}
			}
			setIsLoading(false);
		});
	};

	return [call, isLoading, data];
};

// Makes a pagination calls. Handles the loading and error states.
export const usePagination = (callback, defaultData, defaultFilter = {}) => {
	const [filter, setFilter] = useState(defaultFilter);
	const [isLoading, setIsLoading] = useState(false);
	const [isError, setIsError] = useState(false);
	const [isLastPage, setIsLastPage] = useState(false);
	const [pageNumber, setPageNumber] = useState(1);
	const [data, setData] = useState(defaultData);

	const call = (pageNumber, filter, data) => {
		setIsError(false);
		setIsLoading(true);
		setTimeout(async () => {
			try {
				const { data: currentData, pageNumber: currentPageNumber } = await callback({ pageNumber: pageNumber, ...filter });
				if (currentPageNumber === pageNumber) {
					setData([...data, ...currentData]);
					setPageNumber(currentPageNumber);
					setIsLastPage(currentData.length === 0);
				}
			} catch (error) {
				// eslint-disable-next-line no-console
				console.error('[Pagination] Error:', error);
				setIsError(true);
			}
			setIsLoading(false);
		});
	};

	const initialRequest = () => {
		setFilter(defaultFilter);
		setIsLoading(false);
		setIsError(false);
		setIsLastPage(false);
		setPageNumber(1);
		setData(defaultData);
		call(1, defaultFilter, defaultData);
	};

	const requestNextPage = () => {
		const nextPageNumber = pageNumber + 1;
		call(nextPageNumber, filter, data);
	};

	const changeFilter = filter => {
		setData([]);
		setPageNumber(0);
		setFilter(filter);
		call(1, filter, []);
	};

	const clearFilter = () => {
		changeFilter(defaultFilter);
	};

	return { requestNextPage, initialRequest, data, isLoading, pageNumber, isLastPage, filter, isError, changeFilter, clearFilter };
};

// Paginate a data list.
export const useClientSidePagination = (fullData, pageSize = 10) => {
	const [isLastPage, setIsLastPage] = useState(false);
	const [pageNumber, setPageNumber] = useState(1);
	const [dataChunks, setDataChunks] = useState([]);
	const [data, setData] = useState([]);

	const requestNextPage = () => {
		const nextPageNumber = pageNumber + 1;
		const page = dataChunks[pageNumber];

		if (!dataChunks[nextPageNumber]) {
			setIsLastPage(true);
		}

		if (page) {
			setData([...data, ...page]);
			setPageNumber(nextPageNumber);
		}
	};

	useEffect(() => {
		const dataChunks = _.chunk(fullData, pageSize);
		const page = dataChunks[0];
		setDataChunks(dataChunks);
		setData(page || []);
		setIsLastPage(false);
		setPageNumber(1);
	}, [fullData, pageSize]);

	return { requestNextPage, data, pageNumber, isLastPage };
};

// Makes an async call and handle a filter.
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
				console.error(error);
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

// Filters a data list.
export const useClientSideFilter = data => {
	const [filter, setFilter] = useState({});
	const filteredData = data.filter(item => Object.keys(filter).every(filterKey => item[filterKey] === filter[filterKey]));

	return {
		data: filteredData,
		filter,
		changeFilter: setFilter
	};
};

// Makes a call preventing a throttle. Used to handle the user inputs.
export const useDebounce = callback => {
	const [timer, setTimer] = useState(setTimeout(() => {}));
	const delay = 750;

	const call = (...args) => {
		if (timer) clearTimeout(timer);

		const newTimer = setTimeout(() => callback(...args), delay);
		setTimer(newTimer);
	};

	return [call];
};

// Handles the boolean state. Switch between "true" and "false".
export const useToggle = initialValue => {
	const [value, setValue] = useState(initialValue);

	const toggle = () => setValue(value => !value);

	return [value, toggle];
};

// Provides access to local storage.
export const useStorage = (key, initialValue, callback) => {
	const [value, setValue] = useState(initialValue);
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
				const value = localStorage.getItem(STORAGE_KEY.TIMESTAMP_TYPE);
				return value || defaultValue;
			},
			set: value => {
				localStorage.setItem(STORAGE_KEY.TIMESTAMP_TYPE, value);
				dispatchEvent(new Event(getEvent(STORAGE_KEY.TIMESTAMP_TYPE)));
			}
		},
		[STORAGE_KEY.USER_CURRENCY]: {
			get: () => {
				const defaultValue = 'USD';
				const value = localStorage.getItem(STORAGE_KEY.USER_CURRENCY);
				return value || defaultValue;
			},
			set: value => {
				localStorage.setItem(STORAGE_KEY.USER_CURRENCY, value);
				dispatchEvent(new Event(getEvent(STORAGE_KEY.USER_CURRENCY)));
			}
		},
		[STORAGE_KEY.USER_LANGUAGE]: {
			get: () => {
				const defaultValue = 'en';
				const value = localStorage.getItem(STORAGE_KEY.USER_LANGUAGE);
				return value || defaultValue;
			},
			set: value => {
				localStorage.setItem(STORAGE_KEY.USER_LANGUAGE, value);
				dispatchEvent(new Event(getEvent(STORAGE_KEY.USER_LANGUAGE)));
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

// Fetches user currency price and converts the amount.
export const useUserCurrencyAmount = (fetchPrice, amount, currency, timestamp) => {
	const [amountInUserCurrency, setAmountInUserCurrency] = useState(null);

	useEffect(() => {
		const fetchUserCurrencyAmount = async () => {
			const price = await fetchPrice(timestamp || Date.now(), currency);

			setAmountInUserCurrency(amount * price);
		};

		if (amount) {
			fetchUserCurrencyAmount();
		} else {
			setAmountInUserCurrency(0);
		}
	}, [fetchPrice, amount, currency, timestamp]);

	return amountInUserCurrency;
};

// Makes an async call on mount. Allows to repeat the call with a given interval.
export const useAsyncCall = (callback, defaultData, pollingInterval) => {
	const [data, setData] = useState(defaultData);

	useEffect(() => {
		const call = async () => {
			try {
				const data = await callback();
				setData(data);
			} catch {}
		};

		if (pollingInterval) {
			setInterval(() => call(), pollingInterval);
		} else {
			call();
		}
	}, []);

	return data;
};
