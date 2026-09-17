import {
	useAsyncCall,
	useClientSideFilter,
	useDataManager,
	useDebounce,
	useFilter,
	usePagination,
	useStorage,
	useToggle,
	useUserCurrencyAmount
} from '@/app/utils/hooks';
import { act, renderHook, waitFor } from '@testing-library/react';

beforeAll(() => {
	jest.useFakeTimers();
});

describe('utils/hooks', () => {
	describe('useDataManager', () => {
		it('returns data after async call completion', async () => {
			// Arrange:
			const callback = jest.fn().mockImplementation(() => Promise.resolve(5));
			const defaultData = 12;
			const onError = jest.fn();
			const defaultLoadingState = undefined;
			const expectedResult = 5;

			// Act:
			const { result } = renderHook(() => useDataManager(callback, defaultData, onError, defaultLoadingState));

			// Assert initial state:
			const [call, isLoadingBeforeCall, dataBeforeCall] = result.current;
			expect(dataBeforeCall).toBe(12);
			expect(isLoadingBeforeCall).toBe(false);

			// Call:
			act(() => {
				call();
			});

			// Assert state after call:
			const [, isLoadingAfterCall, dataBAfterCall] = result.current;
			expect(dataBAfterCall).toBe(12);
			expect(isLoadingAfterCall).toBe(true);

			// Wait for the call to finish:
			act(() => {
				jest.runAllTimers();
			});

			await waitFor(() => expect(result.current[1]).toBe(false));

			// Assert state after completion:
			const [, isLoadingAfterCompletion, dataAfterCompletion] = result.current;
			expect(isLoadingAfterCompletion).toBe(false);
			expect(dataAfterCompletion).toBe(expectedResult);
		});

		it('calls onError callback when async call promise rejected', async () => {
			// Arrange:
			const callback = jest.fn().mockImplementation(() => Promise.reject(Error('some error')));
			const defaultData = 12;
			const onError = jest.fn();
			const defaultLoadingState = true;

			// Act:
			const { result } = renderHook(() => useDataManager(callback, defaultData, onError, defaultLoadingState));

			// Assert initial state:
			const [call, isLoadingBeforeCall, dataBeforeCall] = result.current;
			expect(dataBeforeCall).toBe(12);
			expect(isLoadingBeforeCall).toBe(true);

			// Call:
			act(() => {
				call();
			});

			// Assert state after call:
			const [, isLoadingAfterCall, dataBAfterCall] = result.current;
			expect(dataBAfterCall).toBe(12);
			expect(isLoadingAfterCall).toBe(true);

			// Wait for the call to finish:
			act(() => {
				jest.runAllTimers();
			});

			await waitFor(() => expect(result.current[1]).toBe(false));

			// Assert state after completion:
			const [, isLoadingAfterCompletion, dataAfterCompletion] = result.current;
			expect(isLoadingAfterCompletion).toBe(false);
			expect(dataAfterCompletion).toBe(12);
			expect(onError).toHaveBeenCalledWith(Error('some error'));
		});
	});

	describe('usePagination', () => {
		const page1 = { data: [1, 2, 3], pageNumber: 1 };
		const page2 = { data: [4, 5, 6], pageNumber: 2 };

		it('adds a new page to the list ', async () => {
			// Arrange:
			const callback = jest.fn().mockImplementation(() => Promise.resolve(page2));
			const defaultData = page1.data;
			const defaultFilter = undefined;
			const expectedResult = [...page1.data, ...page2.data];

			// Act:
			const { result } = renderHook(() => usePagination(callback, defaultData, defaultFilter));

			// Assert initial state:
			expect(result.current.data).toBe(defaultData);
			expect(result.current.isLoading).toBe(false);
			expect(result.current.isError).toBe(false);
			expect(result.current.isLastPage).toBe(false);
			expect(result.current.pageNumber).toBe(1);

			// Request new page:
			act(() => {
				result.current.requestNextPage();
			});

			// Assert state after call:
			expect(result.current.data).toBe(defaultData);
			expect(result.current.isLoading).toBe(true);
			expect(result.current.isError).toBe(false);
			expect(result.current.isLastPage).toBe(false);
			expect(result.current.pageNumber).toBe(1);

			// Wait for the call to finish:
			act(() => {
				jest.runAllTimers();
			});

			await waitFor(() => expect(result.current.isLoading).toBe(false));

			// Assert state after completion:
			expect(result.current.data).toStrictEqual(expectedResult);
			expect(result.current.isLoading).toBe(false);
			expect(result.current.isError).toBe(false);
			expect(result.current.isLastPage).toBe(false);
			expect(result.current.pageNumber).toBe(2);
		});

		it('requests a new page with filter', async () => {
			// Arrange:
			const callback = jest.fn().mockImplementation(() => Promise.resolve(page1));
			const defaultData = page1.data;
			const defaultFilter = { some: 'filter' };
			const expectedRequestArgument = { some: 'new filter', pageNumber: 1 };

			// Act:
			const { result } = renderHook(() => usePagination(callback, defaultData, defaultFilter));

			// Request new page:
			act(() => {
				result.current.changeFilter({ some: 'new filter' });
			});

			// Wait for the call to finish:
			act(() => {
				jest.runAllTimers();
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			// Assert state after completion:
			expect(callback).toHaveBeenCalledWith(expectedRequestArgument);
			expect(result.current.data).toStrictEqual(page1.data);
			expect(result.current.pageNumber).toBe(1);
			expect(result.current.isError).toBe(false);

			// Clear filter:
			act(() => {
				result.current.clearFilter();
			});

			// Wait for the filter to clear:
			act(() => {
				jest.runAllTimers();
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			// Assert state after clear filter:
			expect(result.current.filter).toStrictEqual(defaultFilter);
			expect(result.current.pageNumber).toBe(1);
			expect(result.current.isError).toBe(false);
		});

		it('makes an initial request', async () => {
			// Arrange:
			const callback = jest.fn().mockImplementation(() => Promise.resolve(page1));
			const defaultData = [];
			const defaultFilter = { some: 'filter' };
			const expectedRequestArgument = { some: 'filter', pageNumber: 1 };

			// Act:
			const { result } = renderHook(() => usePagination(callback, defaultData, defaultFilter));

			// Initial request:
			act(() => {
				result.current.initialRequest();
			});

			// Wait for the call to finish:
			act(() => {
				jest.runAllTimers();
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			// Assert state after completion:
			expect(callback).toHaveBeenCalledWith(expectedRequestArgument);
			expect(result.current.data).toStrictEqual(page1.data);
			expect(result.current.pageNumber).toBe(1);
			expect(result.current.isError).toBe(false);
		});

		it('handles error when async call promise rejected', async () => {
			// Arrange:
			const callback = jest.fn().mockImplementation(() => Promise.reject(Error('some error')));
			const defaultData = page1.data;

			// Act:
			const { result } = renderHook(() => usePagination(callback, defaultData));

			// Request new page:
			act(() => {
				result.current.requestNextPage();
			});

			// Wait for the call to finish:
			act(() => {
				jest.runAllTimers();
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			// Assert state after completion:
			expect(result.current.data).toStrictEqual(page1.data);
			expect(result.current.isLoading).toBe(false);
			expect(result.current.isError).toBe(true);
			expect(result.current.isLastPage).toBe(false);
			expect(result.current.pageNumber).toBe(1);
		});

		it('flags a contract-violating callback response without data instead of treating it as an empty page', async () => {
			// Arrange:
			const callback = jest.fn().mockResolvedValue({ pageNumber: 2 });
			const defaultData = page1.data;
			const { result } = renderHook(() => usePagination(callback, defaultData));

			// Act:
			act(() => {
				result.current.requestNextPage();
				jest.runAllTimers();
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			// Assert:
			expect(result.current.data).toStrictEqual(defaultData);
			expect(result.current.isError).toBe(true);
		});

		it('retries an initial SSR failure with the original filter and first page number', async () => {
			// Arrange: SSR failed before any client request could save retry parameters.
			const callback = jest.fn().mockResolvedValue({ data: ['first result'], pageNumber: 1, isLastPage: true });
			const { result } = renderHook(() => usePagination(callback, [], { query: 'original' }, {
				initialError: true,
				initialPage: { data: [], pageNumber: 1, isLastPage: false, nextPageParams: null }
			}));
			expect(result.current.isError).toBe(true);
			expect(callback).not.toHaveBeenCalled();

			// Act:
			act(() => {
				result.current.requestNextPage();
				jest.runOnlyPendingTimers();
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			// Assert: retry starts at page one, preserves the filter and clears the failure.
			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith({ pageNumber: 1, query: 'original' });
			expect(result.current.data).toEqual(['first result']);
			expect(result.current.pageNumber).toBe(1);
			expect(result.current.isError).toBe(false);
			expect(result.current.isLastPage).toBe(true);
		});

		it('passes a cursor and shared page number metadata to the next request', async () => {
			// Arrange:
			const initialPage = {
				data: [{ height: 100 }],
				pageNumber: 1,
				nextPageParams: { fromHeight: 99, sort: 'DESC' },
				isLastPage: false
			};
			const nextPage = {
				data: [{ height: 99 }],
				pageNumber: 2,
				nextPageParams: { fromHeight: 98, sort: 'DESC' },
				isLastPage: false
			};
			const callback = jest.fn().mockResolvedValue(nextPage);
			const { result } = renderHook(() => usePagination(callback, initialPage.data, {}, { initialPage }));

			// Act:
			act(() => {
				result.current.requestNextPage();
			});
			act(() => {
				jest.runAllTimers();
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			// Assert:
			expect(callback).toHaveBeenCalledWith({ fromHeight: 99, sort: 'DESC', pageNumber: 2 });
			expect(result.current.data).toEqual([{ height: 100 }, { height: 99 }]);
			expect(result.current.isLastPage).toBe(false);
		});

		it('retains the cursor and rows for a retry after a continuation retrieval failure', async () => {
			// Arrange:
			const initialPage = {
				data: [{ height: 100 }],
				pageNumber: 1,
				nextPageParams: { fromHeight: 99, sort: 'DESC' },
				isLastPage: false
			};
			const nextPage = { data: [{ height: 99 }], pageNumber: 2, isLastPage: true };
			const callback = jest.fn().mockRejectedValueOnce(Error('request failed')).mockResolvedValueOnce(nextPage);
			const { result } = renderHook(() => usePagination(callback, initialPage.data, {}, { initialPage }));

			// Act: fail the continuation request.
			act(() => {
				result.current.requestNextPage();
			});
			act(() => {
				jest.runAllTimers();
			});
			await waitFor(() => expect(result.current.isError).toBe(true));

			// Assert the failed page remains available and retry the same request.
			expect(result.current.data).toEqual(initialPage.data);
			act(() => {
				result.current.requestNextPage();
			});
			act(() => {
				jest.runAllTimers();
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			expect(callback).toHaveBeenNthCalledWith(1, { fromHeight: 99, sort: 'DESC', pageNumber: 2 });
			expect(callback).toHaveBeenNthCalledWith(2, { fromHeight: 99, sort: 'DESC', pageNumber: 2 });
			expect(result.current.data).toEqual([{ height: 100 }, { height: 99 }]);
			expect(result.current.isLastPage).toBe(true);
		});

		it('ignores a stale response after a filter starts a newer request', async () => {
			// Arrange:
			const resolvers = {};
			const callback = jest.fn(request => new Promise(resolve => {
				resolvers[request.some] = resolve;
			}));
			const { result } = renderHook(() => usePagination(callback, [], {}));

			// Start the first request and let it reach the callback.
			act(() => {
				result.current.changeFilter({ some: 'first' });
			});
			act(() => {
				jest.runOnlyPendingTimers();
			});
			expect(callback).toHaveBeenCalledTimes(1);

			// Replace it with a newer request.
			act(() => {
				result.current.changeFilter({ some: 'second' });
			});
			act(() => {
				jest.runOnlyPendingTimers();
			});
			expect(callback).toHaveBeenCalledTimes(2);

			await act(async () => {
				resolvers.second({ data: ['new'], pageNumber: 1, isLastPage: true });
			});
			expect(result.current.data).toEqual(['new']);

			await act(async () => {
				resolvers.first({ data: ['stale'], pageNumber: 1, isLastPage: true });
			});

			// Assert:
			expect(result.current.data).toEqual(['new']);
			expect(result.current.isLastPage).toBe(true);
		});

		it('ignores a stale failure after a filter starts a newer request', async () => {
			// Arrange:
			const pendingRequests = {};
			const callback = jest.fn(request => new Promise((resolve, reject) => {
				pendingRequests[request.some] = { resolve, reject };
			}));
			const { result } = renderHook(() => usePagination(callback, [], {}));

			// Act: start both requests and complete the newer one first.
			act(() => {
				result.current.changeFilter({ some: 'first' });
				jest.runOnlyPendingTimers();
			});
			act(() => {
				result.current.changeFilter({ some: 'second' });
				jest.runOnlyPendingTimers();
			});
			await act(async () => {
				pendingRequests.second.resolve({ data: ['new'], pageNumber: 1, isLastPage: true });
			});
			await act(async () => {
				pendingRequests.first.reject(Error('stale failure'));
			});

			// Assert:
			expect(result.current.data).toEqual(['new']);
			expect(result.current.isError).toBe(false);
			expect(result.current.isLastPage).toBe(true);
		});

		it('prevents duplicate continuation requests while one is in flight', async () => {
			// Arrange:
			const callback = jest.fn().mockResolvedValue({ data: [4], pageNumber: 2, isLastPage: true });
			const { result } = renderHook(() => usePagination(callback, [1, 2, 3]));

			// Act:
			act(() => {
				result.current.requestNextPage();
				result.current.requestNextPage();
			});
			act(() => {
				jest.runAllTimers();
			});
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			// Assert:
			expect(callback).toHaveBeenCalledTimes(1);
			expect(result.current.data).toEqual([1, 2, 3, 4]);
		});

		it.each([
			['changeFilter', hook => hook.changeFilter({ query: 'new' }), { pageNumber: 1, query: 'new' }],
			['clearFilter', hook => hook.clearFilter(), { pageNumber: 1, query: 'old' }]
		])(
			'can retry a failed first request after a previous search reached its last page: %s',
			async (_actionName, filterAction, expectedRequest) => {
				// Arrange:
				const callback = jest.fn()
					.mockResolvedValueOnce({ data: [], pageNumber: 2, isLastPage: true })
					.mockRejectedValueOnce(Error('search unavailable'))
					.mockResolvedValueOnce({ data: ['new-result'], pageNumber: 1, isLastPage: true });
				const { result } = renderHook(() => usePagination(callback, ['old-result'], { query: 'old' }));

				// Act: finish the previous search at its last page.
				act(() => {
					result.current.requestNextPage();
				});
				act(() => {
					jest.runAllTimers();
				});
				await waitFor(() => expect(result.current.isLastPage).toBe(true));

				// Change the search and fail its first request.
				act(() => {
					filterAction(result.current);
				});
				act(() => {
					jest.runAllTimers();
				});
				await waitFor(() => expect(result.current.isError).toBe(true));

				// Assert the old terminal state cannot suppress retry, and only new results remain after recovery.
				expect(result.current.isLastPage).toBe(false);
				expect(result.current.data).toEqual([]);
				act(() => {
					result.current.requestNextPage();
				});
				act(() => {
					jest.runAllTimers();
				});
				await waitFor(() => expect(result.current.isLoading).toBe(false));

				expect(callback).toHaveBeenNthCalledWith(2, expectedRequest);
				expect(callback).toHaveBeenNthCalledWith(3, expectedRequest);
				expect(result.current.data).toEqual(['new-result']);
				expect(result.current.isLastPage).toBe(true);
			}
		);
	});

	describe('useFilter', () => {
		it('makes an async call and handle a filter', async () => {
			// Arrange:
			const callback = jest.fn().mockImplementation(() => Promise.resolve([1, 2, 3]));
			const defaultData = [4, 5, 6];
			const initialCall = false;
			const expectedData = [1, 2, 3];

			// Act:
			const { result } = renderHook(() => useFilter(callback, defaultData, initialCall));

			// Assert initial state:
			const { data, isLoading, filter } = result.current;
			expect(data).toStrictEqual(defaultData);
			expect(isLoading).toBe(false);
			expect(filter).toStrictEqual({});

			// Call:
			act(() => {
				result.current.changeFilter({ some: 'filter' });
			});

			// Assert state after call:
			const { data: dataAfterCall, isLoading: isLoadingAfterCall, filter: filterAfterCall } = result.current;
			expect(dataAfterCall).toStrictEqual(defaultData);
			expect(isLoadingAfterCall).toBe(true);
			expect(filterAfterCall).toStrictEqual({ some: 'filter' });

			// Wait for the call to finish:
			act(() => {
				jest.runAllTimers();
			});

			await waitFor(() => expect(result.current.isLoading).toBe(false));

			// Assert state after completion:
			const { data: dataAfterCompletion, isLoading: isLoadingAfterCompletion, filter: filterAfterCompletion } = result.current;
			expect(dataAfterCompletion).toStrictEqual(expectedData);
			expect(isLoadingAfterCompletion).toBe(false);
			expect(filterAfterCompletion).toStrictEqual({ some: 'filter' });
		});

		it('makes an initial call', async () => {
			// Arrange:
			const callback = jest.fn().mockImplementation(() => Promise.resolve([1, 2, 3]));
			const defaultData = [4, 5, 6];
			const initialCall = true;
			const expectedData = [1, 2, 3];

			// Act:
			const { result } = renderHook(() => useFilter(callback, defaultData, initialCall));

			// Assert initial state:
			const { data, isLoading, filter } = result.current;
			expect(data).toStrictEqual(defaultData);
			expect(isLoading).toBe(true);
			expect(filter).toStrictEqual({});

			// Wait for the call to finish:
			act(() => {
				jest.runAllTimers();
			});

			await waitFor(() => expect(result.current.isLoading).toBe(false));

			// Assert state after completion:
			const { data: dataAfterCompletion, isLoading: isLoadingAfterCompletion, filter: filterAfterCompletion } = result.current;
			expect(dataAfterCompletion).toStrictEqual(expectedData);
			expect(isLoadingAfterCompletion).toBe(false);
			expect(filterAfterCompletion).toStrictEqual({});
		});
	});

	describe('useClientSideFilter', () => {
		it('filters a data list', () => {
			// Arrange:
			const data = [
				{ name: 'alice', age: 25 },
				{ name: 'bob', age: 30 },
				{ name: 'charlie', age: 35 }
			];

			// Act:
			const { result } = renderHook(() => useClientSideFilter(data));

			// Assert initial state:
			const { data: dataBeforeFilter } = result.current;
			expect(dataBeforeFilter).toStrictEqual(data);

			// Filter data:
			act(() => {
				result.current.changeFilter({ name: 'bob' });
			});

			// Assert state after filter:
			const { data: dataAfterFilter } = result.current;
			expect(dataAfterFilter).toStrictEqual([{ name: 'bob', age: 30 }]);
		});
	});

	describe('useDebounce', () => {
		it('debounces a function call', () => {
			// Arrange:
			const callback = jest.fn();
			const delay = 1000;

			// Act:
			const { result } = renderHook(() => useDebounce(callback));

			// Call the debounced function multiple times:
			act(() => {
				result.current[0]();
			});
			act(() => {
				result.current[0]();
			});
			act(() => {
				result.current[0]();
			});

			// Wait for the debounce to finish:
			act(() => {
				jest.advanceTimersByTime(delay);
			});

			// Assert:
			expect(callback).toHaveBeenCalledTimes(1);
		});
	});

	describe('useToggle', () => {
		const runTest = (defaultValue, expectedValueAfterToggle) => {
			// Act:
			const { result } = renderHook(() => useToggle(defaultValue));
			const [initialValue, toggle] = result.current;

			// Assert initial state:
			expect(initialValue).toBe(defaultValue);

			// Toggle value:
			act(() => {
				toggle();
			});

			// Assert state after toggle:
			const [value] = result.current;
			expect(value).toBe(expectedValueAfterToggle);
		};

		it('toggles a boolean value from false to true', () => {
			// Arrange:
			const defaultValue = false;
			const expectedValueAfterToggle = true;

			// Act + Assert:
			runTest(defaultValue, expectedValueAfterToggle);
		});

		it('toggles a boolean value from true to false', () => {
			// Arrange:
			const defaultValue = true;
			const expectedValueAfterToggle = false;

			// Act + Assert:
			runTest(defaultValue, expectedValueAfterToggle);
		});
	});

	describe('useStorage', () => {
		const runTest = (key, valueToSet, defaultValue) => {
			// Arrange:
			const callback = jest.fn();
			localStorage.clear();

			// Act:
			const { result: hook1 } = renderHook(() => useStorage(key, null, callback));
			const { result: hook2 } = renderHook(() => useStorage(key, null, callback));
			const [value] = hook1.current;
			const [, setValue] = hook2.current;

			// Assert initial state:
			expect(value).toStrictEqual(defaultValue);

			// Set value:
			act(() => {
				setValue(valueToSet);
			});

			// Assert state after set:
			const [valueAfterSet] = hook1.current;
			expect(valueAfterSet).toStrictEqual(valueToSet);
			expect(callback).toHaveBeenCalledWith(valueToSet);
		};

		it('sets address book', () => {
			// Arrange:
			const key = 'ADDRESS_BOOK';
			const valueToSet = [{ name: 'alice', address: 'alice-address' }];
			const defaultValue = [];

			// Act + Assert:
			runTest(key, valueToSet, defaultValue);
		});

		it('sets timestamp type', () => {
			// Arrange:
			const key = 'TIMESTAMP_TYPE';
			const valueToSet = 'LOCAL';
			const defaultValue = 'UTC';

			// Act + Assert:
			runTest(key, valueToSet, defaultValue);
		});

		it('sets user currency', () => {
			// Arrange:
			const key = 'USER_CURRENCY';
			const valueToSet = 'EUR';
			const defaultValue = 'USD';

			// Act + Assert:
			runTest(key, valueToSet, defaultValue);
		});

		it('sets user language', () => {
			// Arrange:
			const key = 'USER_LANGUAGE';
			const valueToSet = 'es';
			const defaultValue = 'en';

			// Act + Assert:
			runTest(key, valueToSet, defaultValue);
		});
	});

	describe('useUserCurrencyAmount', () => {
		const runTest = async (amount, expectedValue, shouldFetchPrice) => {
			// Arrange:
			const fetchPrice = jest.fn().mockResolvedValue(0.85);
			const userCurrency = 'USD';
			const timestamp = 123456;

			// Act:
			const { result } = renderHook(() => useUserCurrencyAmount(fetchPrice, amount, userCurrency, timestamp));
			await waitFor(() => expect(result.current).not.toBe(null));

			// Assert:
			expect(result.current).toBe(expectedValue);
			if (shouldFetchPrice)
				expect(fetchPrice).toHaveBeenCalledWith(123456, 'USD');
			else
				expect(fetchPrice).not.toHaveBeenCalled();
		};

		it('converts an amount to the user currency', async () => {
			// Arrange:
			const amount = 10;
			const expectedValue = 8.5;
			const shouldFetchPrice = true;

			// Act + Assert:
			await runTest(amount, expectedValue, shouldFetchPrice);
		});

		it('does not convert an amount to the user currency when the amount is zero', async () => {
			// Arrange:
			const amount = 0;
			const expectedValue = 0;
			const shouldFetchPrice = false;

			// Act + Assert:
			await runTest(amount, expectedValue, shouldFetchPrice);
		});
	});

	describe('useAsyncCall', () => {
		const runTest = async (callback, pollingInterval, expectedResult) => {
			// Arrange:
			const defaultData = 'defaultValue';
			const shouldCallTimes = pollingInterval ? 2 : 1;

			// Act:
			const { result } = renderHook(() => useAsyncCall(callback, defaultData, pollingInterval));

			act(() => {
				jest.runOnlyPendingTimers();
			});
			await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));

			act(() => {
				jest.runOnlyPendingTimers();
			});

			// Assert:
			await waitFor(() => expect(callback).toHaveBeenCalledTimes(shouldCallTimes));
			await waitFor(() => expect(result.current).toStrictEqual(expectedResult));
		};

		it('calls an async function without polling interval', async () => {
			// Arrange:
			const callback = jest.fn().mockResolvedValueOnce(1).mockResolvedValue(2);
			const pollingInterval = null;
			const expectedValue = 1;

			// Act + Assert:
			await runTest(callback, pollingInterval, expectedValue);
		});

		it('calls an async function with polling interval', async () => {
			// Arrange:
			const callback = jest.fn().mockResolvedValueOnce(1).mockResolvedValue(2);
			const pollingInterval = 15;
			const expectedValue = 2;

			// Act + Assert:
			await runTest(callback, pollingInterval, expectedValue);
		});

		it('does not let an older response overwrite a newer response', async () => {
			// Arrange:
			let resolveFirst;
			let resolveSecond;
			const callback = jest.fn()
				.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
				.mockImplementationOnce(() => new Promise(resolve => { resolveSecond = resolve; }));
			const { result } = renderHook(() => useAsyncCall(callback, 'default value', 15));

			// Act:
			act(() => {
				jest.advanceTimersByTime(30);
			});
			await act(async () => {
				resolveSecond('new value');
			});
			await act(async () => {
				resolveFirst('old value');
			});

			// Assert:
			expect(result.current).toBe('new value');
		});

		it('stops polling when unmounted', () => {
			// Arrange:
			const callback = jest.fn().mockResolvedValue('value');
			const { unmount } = renderHook(() => useAsyncCall(callback, 'default value', 15));

			// Act:
			unmount();
			act(() => {
				jest.advanceTimersByTime(15);
			});

			// Assert:
			expect(callback).not.toHaveBeenCalled();
		});
	});
});
