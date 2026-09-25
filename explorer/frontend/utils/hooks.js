import { STORAGE_KEY } from '@/app/constants';
import { useEffect, useRef, useState } from 'react';

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

/**
 * @typedef {object} PaginationPage
 * @property {Array} data - rows for the requested page.
 * @property {number} pageNumber - the page number requested by the callback.
 * @property {boolean} [isLastPage] - whether no further page should be requested.
 * @property {object|null} [nextPageParams] - cursor parameters for the next page.
 */

/**
 * Makes pagination calls and handles the loading and error states.
 * @param {(request: object) => Promise<PaginationPage>} callback - returns the rows and requested page number.
 * @param {Array} defaultData - initially displayed rows.
 * @param {object} [defaultFilter] - initial filter.
 * @param {object} [options] - initial page and error state.
 * @returns {object} pagination state and actions.
 */
export const usePagination = (callback, defaultData, defaultFilter = {}, options = {}) => {
	const initialPage = options.initialPage || { data: defaultData, pageNumber: 1 };
	const [filter, setFilter] = useState(defaultFilter);
	const [isLoading, setIsLoading] = useState(false);
	const [isError, setIsError] = useState(!!options.initialError);
	const [isLastPage, setIsLastPage] = useState(!!initialPage.isLastPage && !options.initialError);
	const [pageNumber, setPageNumber] = useState(1);
	const [data, setData] = useState(defaultData);
	const [page, setPage] = useState(initialPage);
	const requestIdRef = useRef(0);
	const requestInFlightRef = useRef(false);
	const lastRequestRef = useRef({ request: { pageNumber: 1, ...defaultFilter }, pageNumber: 1, data: defaultData });

	const call = (request, expectedPageNumber, currentData) => {
		const requestId = ++requestIdRef.current;
		requestInFlightRef.current = true;
		lastRequestRef.current = { request, pageNumber: expectedPageNumber, data: currentData };
		setIsError(false);
		setIsLoading(true);
		setTimeout(async () => {
			try {
				const response = await callback(request);
				if (requestId !== requestIdRef.current)
					return;

				const responseData = response.data;
				setData([...currentData, ...responseData]);
				setPage(response);
				setPageNumber(response.pageNumber);
				setIsLastPage(response.isLastPage ?? responseData.length === 0);
			} catch (error) {
				if (requestId !== requestIdRef.current)
					return;

				// eslint-disable-next-line no-console
				console.error('[Pagination] Error:', error);
				setIsError(true);
			} finally {
				if (requestId === requestIdRef.current) {
					requestInFlightRef.current = false;
					setIsLoading(false);
				}
			}
		});
	};

	const createRequest = (nextPageNumber, nextFilter, previousPage) => {
		if (previousPage?.nextPageParams)
			return { ...nextFilter, ...previousPage.nextPageParams, pageNumber: nextPageNumber };

		return { pageNumber: nextPageNumber, ...nextFilter };
	};

	const initialRequest = () => {
		setFilter(defaultFilter);
		setIsLoading(false);
		setIsError(false);
		setIsLastPage(false);
		setPageNumber(1);
		setData(defaultData);
		setPage(initialPage);
		call({ pageNumber: 1, ...defaultFilter }, 1, defaultData);
	};

	const requestNextPage = () => {
		if (isLastPage || requestInFlightRef.current)
			return;

		if (isError) {
			const { request, pageNumber: failedPageNumber, data: failedData } = lastRequestRef.current;
			call(request, failedPageNumber, failedData);
			return;
		}

		const nextPageNumber = pageNumber + 1;
		call(createRequest(nextPageNumber, filter, page), nextPageNumber, data);
	};

	const changeFilter = filter => {
		setData([]);
		setPageNumber(0);
		setPage({ data: [], pageNumber: 0 });
		setIsLastPage(false);
		setFilter(filter);
		call({ pageNumber: 1, ...filter }, 1, []);
	};

	const clearFilter = () => {
		changeFilter(defaultFilter);
	};

	return { requestNextPage, initialRequest, data, isLoading, pageNumber, isLastPage, filter, isError, changeFilter, clearFilter };
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

// Makes an async call on mount. Allows to repeat the call with a given interval.
export const useAsyncCall = (callback, defaultData, pollingInterval) => {
	const [data, setData] = useState(defaultData);
	// keep the latest callback without retriggering the effect (callers pass inline functions)
	const callbackRef = useRef();
	callbackRef.current = callback;

	useEffect(() => {
		let isActive = true;
		let requestId = 0;
		let intervalId;

		const call = async () => {
			const currentRequestId = ++requestId;

			try {
				const data = await callbackRef.current();
				if (!isActive || currentRequestId !== requestId)
					return;

				setData(data);
			} catch {
				// keep the previous data on failure
			}
		};

		if (pollingInterval)
			intervalId = setInterval(() => call(), pollingInterval);
		if (!pollingInterval)
			call();

		return () => {
			isActive = false;
			requestId++;
			if (intervalId)
				clearInterval(intervalId);
		};
	}, [pollingInterval]);

	return data;
};
