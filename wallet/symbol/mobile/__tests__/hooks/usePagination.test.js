import { usePagination } from '@/app/hooks/usePagination';
import { act, renderHook } from '@testing-library/react-native';

const DEFAULT_PAGE_SIZE = 10;
const FIRST_PAGE_NUMBER = 1;
const CUSTOM_FIRST_PAGE_NUMBER = 0;
const ERROR_MESSAGE = 'Fetch error';

const PAGE_1_DATA = [{ id: 1, name: 'item1' }, { id: 2, name: 'item2' }];
const PAGE_2_DATA = [{ id: 3, name: 'item3' }, { id: 4, name: 'item4' }];
const EMPTY_PAGE_DATA = [];
const INCOMPLETE_PAGE_DATA = [{ id: 5, name: 'item5' }];
const DEFAULT_DATA = [{ id: 0, name: 'default' }];

const createMockCallback = (pages = { 1: PAGE_1_DATA, 2: PAGE_2_DATA }) => {
	return jest.fn().mockImplementation(({ pageNumber }) => {
		return Promise.resolve(pages[pageNumber] ?? EMPTY_PAGE_DATA);
	});
};

const createFailingCallback = (error = new Error(ERROR_MESSAGE)) => {
	return jest.fn().mockRejectedValue(error);
};

const createConfig = (overrides = {}) => ({
	callback: createMockCallback(),
	defaultData: [],
	onError: null,
	pageSize: DEFAULT_PAGE_SIZE,
	firstPageNumber: FIRST_PAGE_NUMBER,
	dataUpdater: undefined,
	defaultLoadingState: false,
	...overrides
});

describe('hooks/usePagination', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		__DEV__ = false;
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('initialization', () => {
		const runInitializationTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const { result } = renderHook(() => usePagination(config));

				// Assert:
				expect(result.current.isLoading).toBe(expected.isLoading);
				expect(result.current.isLastPage).toBe(expected.isLastPage);
				expect(result.current.pageNumber).toBe(expected.pageNumber);
				expect(result.current.data).toEqual(expected.data);
				expect(result.current.error).toBe(expected.error);
			});
		};

		const tests = [
			{
				description: 'initializes with default values',
				config: createConfig(),
				expected: {
					isLoading: false,
					isLastPage: false,
					pageNumber: FIRST_PAGE_NUMBER,
					data: [],
					error: null
				}
			},
			{
				description: 'initializes with custom default data',
				config: createConfig({ defaultData: DEFAULT_DATA }),
				expected: {
					isLoading: false,
					isLastPage: false,
					pageNumber: FIRST_PAGE_NUMBER,
					data: DEFAULT_DATA,
					error: null
				}
			},
			{
				description: 'initializes with custom first page number',
				config: createConfig({ firstPageNumber: CUSTOM_FIRST_PAGE_NUMBER }),
				expected: {
					isLoading: false,
					isLastPage: false,
					pageNumber: CUSTOM_FIRST_PAGE_NUMBER,
					data: [],
					error: null
				}
			},
			{
				description: 'initializes with custom loading state',
				config: createConfig({ defaultLoadingState: true }),
				expected: {
					isLoading: true,
					isLastPage: false,
					pageNumber: FIRST_PAGE_NUMBER,
					data: [],
					error: null
				}
			}
		];

		tests.forEach(test => {
			runInitializationTest(test.description, test.config, test.expected);
		});

		it('returns all required properties and functions', () => {
			// Arrange:
			const config = createConfig();

			// Act:
			const { result } = renderHook(() => usePagination(config));

			// Assert:
			expect(result.current).toHaveProperty('isLoading');
			expect(result.current).toHaveProperty('isLastPage');
			expect(result.current).toHaveProperty('pageNumber');
			expect(result.current).toHaveProperty('data');
			expect(result.current).toHaveProperty('error');
			expect(result.current).toHaveProperty('fetchFirstPage');
			expect(result.current).toHaveProperty('fetchNextPage');
			expect(result.current).toHaveProperty('setData');
			expect(result.current).toHaveProperty('reset');
			expect(typeof result.current.fetchFirstPage).toBe('function');
			expect(typeof result.current.fetchNextPage).toBe('function');
			expect(typeof result.current.setData).toBe('function');
			expect(typeof result.current.reset).toBe('function');
		});
	});

	describe('fetchNextPage', () => {
		it('sets loading state when fetchNextPage is called', async () => {
			// Arrange:
			const config = createConfig();
			const { result } = renderHook(() => usePagination(config));

			// Act:
			act(() => {
				result.current.fetchNextPage();
			});

			// Assert:
			expect(result.current.isLoading).toBe(true);
		});

		it('fetches and appends first page data', async () => {
			// Arrange:
			const mockCallback = createMockCallback();
			const config = createConfig({ callback: mockCallback });
			const { result } = renderHook(() => usePagination(config));

			// Act:
			await act(async () => {
				const promise = result.current.fetchNextPage();
				jest.runAllTimers();
				await promise;
			});

			// Assert:
			expect(result.current.data).toEqual(PAGE_1_DATA);
			expect(result.current.pageNumber).toBe(2);
			expect(result.current.isLoading).toBe(false);
		});

		it('passes pageNumber and pageSize to callback', async () => {
			// Arrange:
			const mockCallback = createMockCallback();
			const expectedPageSize = 20;
			const config = createConfig({ callback: mockCallback, pageSize: expectedPageSize });
			const { result } = renderHook(() => usePagination(config));

			// Act:
			await act(async () => {
				const promise = result.current.fetchNextPage();
				jest.runAllTimers();
				await promise;
			});

			// Assert:
			expect(mockCallback).toHaveBeenCalledWith({
				pageNumber: FIRST_PAGE_NUMBER,
				pageSize: expectedPageSize
			});
		});

		it('appends next page data to existing data', async () => {
			// Arrange:
			const mockCallback = createMockCallback();
			const config = createConfig({ callback: mockCallback, pageSize: PAGE_1_DATA.length });
			const { result } = renderHook(() => usePagination(config));
			const expectedData = [...PAGE_1_DATA, ...PAGE_2_DATA];

			// Act:
			await act(async () => {
				const promise = result.current.fetchNextPage();
				jest.runAllTimers();
				await promise;
			});
			await act(async () => {
				const promise = result.current.fetchNextPage();
				jest.runAllTimers();
				await promise;
			});

			// Assert:
			expect(result.current.data).toEqual(expectedData);
			expect(result.current.pageNumber).toBe(3);
		});

		it('does not fetch when already loading', async () => {
			// Arrange:
			let resolveCallback;
			const slowCallback = jest.fn().mockImplementation(() =>
				new Promise(resolve => {
					resolveCallback = () => resolve(PAGE_1_DATA);
				}));
			const config = createConfig({ callback: slowCallback });
			const { result } = renderHook(() => usePagination(config));
			const expectedCallCount = 1;

			// Act:
			act(() => {
				result.current.fetchNextPage();
				jest.runAllTimers();
			});
			act(() => {
				result.current.fetchNextPage();
				jest.runAllTimers();
			});

			await act(async () => {
				resolveCallback();
				await Promise.resolve();
			});

			// Assert:
			expect(slowCallback).toHaveBeenCalledTimes(expectedCallCount);
		});

		it('does not fetch when last page is reached', async () => {
			// Arrange:
			const mockCallback = createMockCallback({ 1: INCOMPLETE_PAGE_DATA });
			const config = createConfig({ callback: mockCallback, pageSize: DEFAULT_PAGE_SIZE });
			const { result } = renderHook(() => usePagination(config));

			await act(async () => {
				const promise = result.current.fetchNextPage();
				jest.runAllTimers();
				await promise;
			});

			// Act:
			await act(async () => {
				result.current.fetchNextPage();
				jest.runAllTimers();
				await Promise.resolve();
			});

			// Assert:
			expect(mockCallback).toHaveBeenCalledTimes(1);
			expect(result.current.isLastPage).toBe(true);
		});

		describe('last page detection', () => {
			const runLastPageDetectionTest = (description, config, expected) => {
				it(description, async () => {
					// Arrange:
					const hookConfig = createConfig(config);
					const { result } = renderHook(() => usePagination(hookConfig));

					// Act:
					await act(async () => {
						const promise = result.current.fetchNextPage();
						jest.runAllTimers();
						await promise;
					});

					// Assert:
					expect(result.current.isLastPage).toBe(expected.isLastPage);
				});
			};

			const tests = [
				{
					description: 'sets isLastPage to true when page is empty',
					config: { callback: createMockCallback({ 1: EMPTY_PAGE_DATA }) },
					expected: { isLastPage: true }
				},
				{
					description: 'sets isLastPage to true when page has fewer items than pageSize',
					config: {
						callback: createMockCallback({ 1: INCOMPLETE_PAGE_DATA }),
						pageSize: DEFAULT_PAGE_SIZE
					},
					expected: { isLastPage: true }
				},
				{
					description: 'does not set isLastPage when page is full',
					config: {
						callback: createMockCallback({ 1: PAGE_1_DATA }),
						pageSize: PAGE_1_DATA.length
					},
					expected: { isLastPage: false }
				},
				{
					description: 'does not set isLastPage when pageSize is null',
					config: {
						callback: createMockCallback({ 1: INCOMPLETE_PAGE_DATA }),
						pageSize: null
					},
					expected: { isLastPage: false }
				}
			];

			tests.forEach(test => {
				runLastPageDetectionTest(test.description, test.config, test.expected);
			});
		});
	});

	describe('fetchFirstPage', () => {
		it('fetches first page and replaces existing data', async () => {
			// Arrange:
			const mockCallback = createMockCallback();
			const config = createConfig({ callback: mockCallback });
			const { result } = renderHook(() => usePagination(config));

			await act(async () => {
				const promise = result.current.fetchNextPage();
				jest.runAllTimers();
				await promise;
			});

			// Act:
			await act(async () => {
				const promise = result.current.fetchFirstPage();
				jest.runAllTimers();
				await promise;
			});

			// Assert:
			expect(result.current.data).toEqual(PAGE_1_DATA);
			expect(result.current.pageNumber).toBe(2);
		});

		it('resets isLastPage before fetching', async () => {
			// Arrange:
			const mockCallback = createMockCallback({ 1: EMPTY_PAGE_DATA });
			const config = createConfig({ callback: mockCallback, pageSize: PAGE_1_DATA.length });
			const { result } = renderHook(() => usePagination(config));

			await act(async () => {
				const promise = result.current.fetchNextPage();
				jest.runAllTimers();
				await promise;
			});
			expect(result.current.isLastPage).toBe(true);

			// Override callback to return full page data
			mockCallback.mockImplementation(() => Promise.resolve(PAGE_1_DATA));

			// Act:
			await act(async () => {
				const promise = result.current.fetchFirstPage();
				jest.runAllTimers();
				await promise;
			});

			// Assert:
			expect(result.current.isLastPage).toBe(false);
		});

		it('does not fetch when already loading', async () => {
			// Arrange:
			let resolveCallback;
			const slowCallback = jest.fn().mockImplementation(() =>
				new Promise(resolve => {
					resolveCallback = () => resolve(PAGE_1_DATA);
				}));
			const config = createConfig({ callback: slowCallback });
			const { result } = renderHook(() => usePagination(config));
			const expectedCallCount = 1;

			// Act:
			act(() => {
				result.current.fetchFirstPage();
				jest.runAllTimers();
			});
			act(() => {
				result.current.fetchFirstPage();
				jest.runAllTimers();
			});

			await act(async () => {
				resolveCallback();
				await Promise.resolve();
			});

			// Assert:
			expect(slowCallback).toHaveBeenCalledTimes(expectedCallCount);
		});
	});

	describe('error handling', () => {
		it('sets error state on callback failure', async () => {
			// Arrange:
			const expectedError = new Error(ERROR_MESSAGE);
			const failingCallback = createFailingCallback(expectedError);
			const onErrorMock = jest.fn();
			const config = createConfig({ callback: failingCallback, onError: onErrorMock });
			const { result } = renderHook(() => usePagination(config));

			// Act:
			await act(async () => {
				const promise = result.current.fetchNextPage();
				jest.runAllTimers();
				await promise.catch(() => {});
			});

			// Assert:
			expect(result.current.error).toEqual(expectedError);
			expect(result.current.isLoading).toBe(false);
		});

		it('calls onError callback when provided', async () => {
			// Arrange:
			const expectedError = new Error(ERROR_MESSAGE);
			const failingCallback = createFailingCallback(expectedError);
			const onErrorMock = jest.fn();
			const config = createConfig({ callback: failingCallback, onError: onErrorMock });
			const { result } = renderHook(() => usePagination(config));

			// Act:
			await act(async () => {
				const promise = result.current.fetchNextPage();
				jest.runAllTimers();
				await promise.catch(() => {});
			});

			// Assert:
			expect(onErrorMock).toHaveBeenCalledWith(expectedError);
		});

		it('does not update data on error', async () => {
			// Arrange:
			const failingCallback = createFailingCallback();
			const onErrorMock = jest.fn();
			const config = createConfig({
				callback: failingCallback,
				defaultData: DEFAULT_DATA,
				onError: onErrorMock
			});
			const { result } = renderHook(() => usePagination(config));

			// Act:
			await act(async () => {
				const promise = result.current.fetchNextPage();
				jest.runAllTimers();
				await promise.catch(() => {});
			});

			// Assert:
			expect(result.current.data).toEqual(DEFAULT_DATA);
		});
	});

	describe('reset', () => {
		it('resets pagination state to initial values', async () => {
			// Arrange:
			const mockCallback = createMockCallback();
			const config = createConfig({ callback: mockCallback, defaultData: DEFAULT_DATA });
			const { result } = renderHook(() => usePagination(config));

			await act(async () => {
				const promise = result.current.fetchNextPage();
				jest.runAllTimers();
				await promise;
			});

			// Act:
			act(() => {
				result.current.reset();
			});

			// Assert:
			expect(result.current.data).toEqual(DEFAULT_DATA);
			expect(result.current.pageNumber).toBe(FIRST_PAGE_NUMBER);
			expect(result.current.isLastPage).toBe(false);
			expect(result.current.isLoading).toBe(false);
			expect(result.current.error).toBe(null);
		});

		it('resets to custom first page number', async () => {
			// Arrange:
			const mockCallback = createMockCallback({ 0: PAGE_1_DATA, 1: PAGE_2_DATA });
			const config = createConfig({
				callback: mockCallback,
				firstPageNumber: CUSTOM_FIRST_PAGE_NUMBER
			});
			const { result } = renderHook(() => usePagination(config));

			await act(async () => {
				const promise = result.current.fetchNextPage();
				jest.runAllTimers();
				await promise;
			});

			// Act:
			act(() => {
				result.current.reset();
			});

			// Assert:
			expect(result.current.pageNumber).toBe(CUSTOM_FIRST_PAGE_NUMBER);
		});

		it('resets error state', async () => {
			// Arrange:
			const failingCallback = createFailingCallback();
			const onErrorMock = jest.fn();
			const config = createConfig({ callback: failingCallback, onError: onErrorMock });
			const { result } = renderHook(() => usePagination(config));

			await act(async () => {
				const promise = result.current.fetchNextPage();
				jest.runAllTimers();
				await promise.catch(() => {});
			});

			// Act:
			act(() => {
				result.current.reset();
			});

			// Assert:
			expect(result.current.error).toBe(null);
		});
	});

	describe('setData', () => {
		it('updates data manually', async () => {
			// Arrange:
			const config = createConfig();
			const { result } = renderHook(() => usePagination(config));
			const newData = [{ id: 100, name: 'manual' }];

			// Act:
			act(() => {
				result.current.setData(newData);
			});

			// Assert:
			expect(result.current.data).toEqual(newData);
		});

		it('replaces fetched data with manual data', async () => {
			// Arrange:
			const mockCallback = createMockCallback();
			const config = createConfig({ callback: mockCallback });
			const { result } = renderHook(() => usePagination(config));
			const newData = [{ id: 100, name: 'manual' }];

			await act(async () => {
				const promise = result.current.fetchNextPage();
				jest.runAllTimers();
				await promise;
			});

			// Act:
			act(() => {
				result.current.setData(newData);
			});

			// Assert:
			expect(result.current.data).toEqual(newData);
		});
	});

	describe('custom dataUpdater', () => {
		it('uses custom dataUpdater when provided', async () => {
			// Arrange:
			const mockCallback = createMockCallback();
			const customDataUpdater = jest.fn((prevData, newData) => [...newData, ...prevData]);
			const config = createConfig({
				callback: mockCallback,
				dataUpdater: customDataUpdater,
				defaultData: DEFAULT_DATA
			});
			const { result } = renderHook(() => usePagination(config));
			const expectedData = [...PAGE_1_DATA, ...DEFAULT_DATA];

			// Act:
			await act(async () => {
				const promise = result.current.fetchNextPage();
				jest.runAllTimers();
				await promise;
			});

			// Assert:
			expect(customDataUpdater).toHaveBeenCalledWith(DEFAULT_DATA, PAGE_1_DATA);
			expect(result.current.data).toEqual(expectedData);
		});

		it('calls custom dataUpdater with empty array on fetchFirstPage', async () => {
			// Arrange:
			const mockCallback = createMockCallback();
			const customDataUpdater = jest.fn((prevData, newData) => [...prevData, ...newData]);
			const config = createConfig({
				callback: mockCallback,
				dataUpdater: customDataUpdater,
				defaultData: DEFAULT_DATA
			});
			const { result } = renderHook(() => usePagination(config));

			// Act:
			await act(async () => {
				const promise = result.current.fetchFirstPage();
				jest.runAllTimers();
				await promise;
			});

			// Assert:
			expect(customDataUpdater).toHaveBeenCalledWith([], PAGE_1_DATA);
		});
	});

	describe('race condition handling', () => {
		it('ignores stale responses after reset', async () => {
			// Arrange:
			let resolveCallback;
			const slowCallback = jest.fn().mockImplementation(() =>
				new Promise(resolve => {
					resolveCallback = () => resolve(PAGE_1_DATA);
				}));
			const config = createConfig({ callback: slowCallback, defaultData: DEFAULT_DATA });
			const { result } = renderHook(() => usePagination(config));

			// Act:
			act(() => {
				result.current.fetchNextPage();
				jest.runAllTimers();
			});

			act(() => {
				result.current.reset();
			});

			await act(async () => {
				resolveCallback();
				await Promise.resolve();
			});

			// Assert:
			expect(result.current.data).toEqual(DEFAULT_DATA);
			expect(result.current.isLoading).toBe(false);
		});
	});
});
