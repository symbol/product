import { PAGINATION_MODE, STORAGE_KEY } from '@/app/constants';
import { useEffect, useRef, useState } from 'react';

const initialPageInfo = { pageNumber: 0, nextPageParams: null };
const paginationStrategies = {
	[PAGINATION_MODE.PAGE]: {
		createRequest: (filter, pageInfo) => ({ pageNumber: pageInfo.pageNumber + 1, ...filter }),
		isLastPage: page => page.data.length === 0
	},
	[PAGINATION_MODE.CURSOR]: {
		createRequest: (filter, pageInfo) => ({ ...filter, ...pageInfo.nextPageParams }),
		isLastPage: page => !page.nextPageParams
	}
};

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
				if (onError)
					onError(error);
			}
			setIsLoading(false);
		});
	};

	return [call, isLoading, data];
};

// Makes a pagination calls. Handles the loading and error states.
export const usePagination = (callback, defaultData, defaultFilter = {}, options = {}) => {
	const { mode = PAGINATION_MODE.PAGE, initialNextPageParams = null } = options;
	const strategy = paginationStrategies[mode];

	// Filter state
	const [filter, setFilter] = useState(defaultFilter);

	// Page state
	const [data, setData] = useState(defaultData);
	const [pageInfo, setPageInfo] = useState({ 
		pageNumber: 1, 
		nextPageParams: initialNextPageParams 
	});
	const [isLastPage, setIsLastPage] = useState(() => strategy.isLastPage({
		data: defaultData,
		nextPageParams: initialNextPageParams
	}));

	// Request state
	const [isLoading, setIsLoading] = useState(false);
	const [isError, setIsError] = useState(false);
	const requestIdRef = useRef(0);

	// Fetch a page and append it to the data. Ignore stale responses.
	const call = (filter, data, pageInfo) => {
		requestIdRef.current += 1;
		const requestId = requestIdRef.current;
		const isStale = () => requestId !== requestIdRef.current;

		const applyPage = page => {
			setData([...data, ...page.data]);
			setPageInfo({ 
				pageNumber: pageInfo.pageNumber + 1, 
				nextPageParams: page.nextPageParams ?? null 
			});
			setIsLastPage(strategy.isLastPage(page));
			setIsLoading(false);
		};

		const applyError = error => {
			// eslint-disable-next-line no-console
			console.error('[Pagination] Error:', error);
			setIsError(true);
			setIsLoading(false);
		};

		setIsError(false);
		setIsLoading(true);
		setTimeout(async () => {
			try {
				const page = await callback(strategy.createRequest(filter, pageInfo));

				if (!isStale())
					applyPage(page);
			} catch (error) {
				if (!isStale())
					applyError(error);
			}
		});
	};

	// Request handlers
	const initialRequest = () => {
		setFilter(defaultFilter);
		setIsLoading(false);
		setIsError(false);
		setIsLastPage(false);
		setPageInfo(initialPageInfo);
		setData(defaultData);
		call(defaultFilter, defaultData, initialPageInfo);
	};
	const requestNextPage = () => {
		call(filter, data, pageInfo);
	};

	// Filter handlers
	const changeFilter = filter => {
		setData([]);
		setPageInfo(initialPageInfo);
		setFilter(filter);
		call(filter, [], initialPageInfo);
	};
	const clearFilter = () => {
		changeFilter(defaultFilter);
	};

	return {
		requestNextPage,
		initialRequest,
		data,
		isLoading,
		pageNumber: pageInfo.pageNumber,
		isLastPage,
		filter,
		isError,
		changeFilter,
		clearFilter
	};
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
		if (initialCall)
			call(filter);
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
		if (timer)
			clearTimeout(timer);

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
	// keep the latest callback without retriggering the effect (callers pass inline functions)
	const callbackRef = useRef();
	callbackRef.current = callback;

	useEffect(() => {
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
		const accessor = storage[key];

		if (!accessor)
			throw Error(`Failed to access store. Unknown key "${key}"`);

		const updateValue = () => {
			const value = accessor.get();
			setValue(value);
			if (callbackRef.current)
				callbackRef.current(value);
		};

		setSetter(() => accessor.set);
		updateValue();
		window?.addEventListener(getEvent(key), updateValue);

		return () => {
			window?.removeEventListener(getEvent(key), updateValue);
		};
	}, [key]);

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

		if (amount)
			fetchUserCurrencyAmount();
		else
			setAmountInUserCurrency(0);
	}, [fetchPrice, amount, currency, timestamp]);

	return amountInUserCurrency;
};

// Repeats an async call on the polling interval; calls on mount when no interval or isCalledOnMount is set.
export const useAsyncCall = (callback, defaultData, pollingInterval, isCalledOnMount) => {
	const [data, setData] = useState(defaultData);
	// keep the latest callback without retriggering the effect (callers pass inline functions)
	const callbackRef = useRef();
	callbackRef.current = callback;

	useEffect(() => {
		const call = async () => {
			try {
				const data = await callbackRef.current();
				setData(data);
			} catch {
				// keep the previous data on failure
			}
		};

		if (!pollingInterval || isCalledOnMount)
			call();

		if (pollingInterval) {
			const intervalId = setInterval(() => call(), pollingInterval);

			return () => clearInterval(intervalId);
		}
	}, [pollingInterval, isCalledOnMount]);

	return data;
};
