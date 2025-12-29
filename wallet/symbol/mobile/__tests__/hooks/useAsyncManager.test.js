import { useAsyncManager } from '@/app/hooks/useAsyncManager';
import { act, renderHook } from '@testing-library/react-native';

const DEFAULT_DATA = { id: 1, name: 'default' };
const RESOLVED_DATA = { id: 2, name: 'resolved' };
const ERROR_MESSAGE = 'Test error';

const createMockCallback = (resolvedValue = RESOLVED_DATA) => jest.fn().mockResolvedValue(resolvedValue);
const createFailingCallback = (error = new Error(ERROR_MESSAGE)) => jest.fn().mockRejectedValue(error);

const createConfig = (overrides = {}) => ({
	callback: createMockCallback(),
	defaultData: null,
	onError: null,
	shouldClearDataOnCall: false,
	defaultLoadingState: false,
	...overrides
});

describe('hooks/useAsyncManager', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		__DEV__ = false;
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('initialization', () => {
		const runInitializationTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const { result } = renderHook(() => useAsyncManager(config));

				// Assert:
				expect(result.current.isLoading).toBe(expected.isLoading);
				expect(result.current.data).toEqual(expected.data);
				expect(result.current.error).toBe(expected.error);
			});
		};

		const tests = [
			{
				description: 'initializes with default values',
				config: createConfig(),
				expected: { isLoading: false, data: null, error: null }
			},
			{
				description: 'initializes with custom default data',
				config: createConfig({ defaultData: DEFAULT_DATA }),
				expected: { isLoading: false, data: DEFAULT_DATA, error: null }
			},
			{
				description: 'initializes with custom loading state',
				config: createConfig({ defaultLoadingState: true }),
				expected: { isLoading: true, data: null, error: null }
			}
		];

		tests.forEach(test => {
			runInitializationTest(test.description, test.config, test.expected);
		});
	});

	describe('call', () => {
		it('sets loading state when call is invoked', async () => {
			// Arrange:
			const config = createConfig();
			const { result } = renderHook(() => useAsyncManager(config));

			// Act:
			act(() => {
				result.current.call();
			});

			// Assert:
			expect(result.current.isLoading).toBe(true);
		});

		it('resolves with data on successful callback', async () => {
			// Arrange:
			const mockCallback = createMockCallback(RESOLVED_DATA);
			const config = createConfig({ callback: mockCallback });
			const { result } = renderHook(() => useAsyncManager(config));

			// Act:
			let resolvedData;
			await act(async () => {
				const promise = result.current.call();
				jest.runAllTimers();
				resolvedData = await promise;
			});

			// Assert:
			expect(resolvedData).toEqual(RESOLVED_DATA);
			expect(result.current.data).toEqual(RESOLVED_DATA);
			expect(result.current.isLoading).toBe(false);
			expect(result.current.error).toBe(null);
		});

		it('passes arguments to callback', async () => {
			// Arrange:
			const mockCallback = createMockCallback();
			const config = createConfig({ callback: mockCallback });
			const { result } = renderHook(() => useAsyncManager(config));
			const argument1 = 'arg1';
			const argument2 = { key: 'value' };

			// Act:
			await act(async () => {
				const promise = result.current.call(argument1, argument2);
				jest.runAllTimers();
				await promise;
			});

			// Assert:
			expect(mockCallback).toHaveBeenCalledWith(argument1, argument2);
		});

		it('clears data on call when shouldClearDataOnCall is true', async () => {
			// Arrange:
			const mockCallback = createMockCallback();
			const config = createConfig({
				callback: mockCallback,
				defaultData: DEFAULT_DATA,
				shouldClearDataOnCall: true
			});
			const { result } = renderHook(() => useAsyncManager(config));

			// Act:
			act(() => {
				result.current.call();
			});

			// Assert:
			expect(result.current.data).toEqual(DEFAULT_DATA);
		});

		it('does not clear data on call when shouldClearDataOnCall is false', async () => {
			// Arrange:
			const mockCallback = createMockCallback({ id: 3, name: 'new' });
			const config = createConfig({ callback: mockCallback, shouldClearDataOnCall: false });
			const { result } = renderHook(() => useAsyncManager(config));

			await act(async () => {
				const promise = result.current.call();
				jest.runAllTimers();
				await promise;
			});

			// Act:
			act(() => {
				result.current.call();
			});

			// Assert:
			expect(result.current.data).toEqual({ id: 3, name: 'new' });
		});
	});

	describe('error handling', () => {
		it('sets error state on callback failure', async () => {
			// Arrange:
			const expectedError = new Error(ERROR_MESSAGE);
			const failingCallback = createFailingCallback(expectedError);
			const config = createConfig({ callback: failingCallback });
			const { result } = renderHook(() => useAsyncManager(config));

			// Act:
			await act(async () => {
				const promise = result.current.call();
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
			const { result } = renderHook(() => useAsyncManager(config));

			// Act:
			await act(async () => {
				const promise = result.current.call();
				jest.runAllTimers();
				await promise.catch(() => {});
			});

			// Assert:
			expect(onErrorMock).toHaveBeenCalledWith(expectedError);
		});

		it('rejects promise on callback failure', async () => {
			// Arrange:
			const expectedError = new Error(ERROR_MESSAGE);
			const failingCallback = createFailingCallback(expectedError);
			const config = createConfig({ callback: failingCallback });
			const { result } = renderHook(() => useAsyncManager(config));

			// Act & Assert:
			await act(async () => {
				const promise = result.current.call();
				jest.runAllTimers();
				await expect(promise).rejects.toThrow(ERROR_MESSAGE);
			});
		});
	});

	describe('reset', () => {
		it('resets to initial state', async () => {
			// Arrange:
			const mockCallback = createMockCallback();
			const config = createConfig({ callback: mockCallback, defaultData: DEFAULT_DATA });
			const { result } = renderHook(() => useAsyncManager(config));

			await act(async () => {
				const promise = result.current.call();
				jest.runAllTimers();
				await promise;
			});

			// Act:
			act(() => {
				result.current.reset();
			});

			// Assert:
			expect(result.current.data).toEqual(DEFAULT_DATA);
			expect(result.current.isLoading).toBe(false);
			expect(result.current.error).toBe(null);
		});

		it('resets error state', async () => {
			// Arrange:
			const failingCallback = createFailingCallback();
			const config = createConfig({ callback: failingCallback });
			const { result } = renderHook(() => useAsyncManager(config));

			await act(async () => {
				const promise = result.current.call();
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

	describe('race condition handling', () => {
		it('ignores stale responses when new call is made', async () => {
			// Arrange:
			const firstData = { id: 1, name: 'first' };
			const secondData = { id: 2, name: 'second' };
			let resolveFirst;
			let resolveSecond;

			const slowCallback = jest.fn()
				.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = () => resolve(firstData); }))
				.mockImplementationOnce(() => new Promise(resolve => { resolveSecond = () => resolve(secondData); }));

			const config = createConfig({ callback: slowCallback });
			const { result } = renderHook(() => useAsyncManager(config));

			// Act:
			act(() => {
				result.current.call();
				jest.runAllTimers();
			});

			act(() => {
				result.current.call();
				jest.runAllTimers();
			});

			await act(async () => {
				resolveSecond();
				await Promise.resolve();
			});

			await act(async () => {
				resolveFirst();
				await Promise.resolve();
			});

			// Assert:
			expect(result.current.data).toEqual(secondData);
		});

		it('ignores stale responses after reset', async () => {
			// Arrange:
			let resolveCallback;
			const slowCallback = jest.fn().mockImplementation(() => new Promise(resolve => {
				resolveCallback = () => resolve(RESOLVED_DATA);
			}));
			const config = createConfig({ callback: slowCallback, defaultData: DEFAULT_DATA });
			const { result } = renderHook(() => useAsyncManager(config));

			// Act:
			act(() => {
				result.current.call();
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

	describe('AsyncManager instance', () => {
		it('returns AsyncManager with all required properties', () => {
			// Arrange:
			const config = createConfig();

			// Act:
			const { result } = renderHook(() => useAsyncManager(config));

			// Assert:
			expect(result.current).toHaveProperty('call');
			expect(result.current).toHaveProperty('isLoading');
			expect(result.current).toHaveProperty('data');
			expect(result.current).toHaveProperty('error');
			expect(result.current).toHaveProperty('reset');
			expect(typeof result.current.call).toBe('function');
			expect(typeof result.current.reset).toBe('function');
		});
	});
});
