import { useDebounce } from '@/app/hooks/useDebounce';
import { act, renderHook } from '@testing-library/react-native';

const DEBOUNCE_DELAY = 500;

describe('hooks/useDebounce', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('immediate first call', () => {
		it('calls callback immediately on first invocation', () => {
			// Arrange:
			const args = ['arg1', 'arg2'];
			const callback = jest.fn();
			const { result } = renderHook(() => useDebounce(callback, DEBOUNCE_DELAY));

			// Act:
			act(() => {
				result.current(...args);
			});

			// Assert:
			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith(...args);
		});
	});

	describe('debounced calls', () => {
		it('debounces rapid successive calls within delay period', () => {
			// Arrange:
			const callback = jest.fn();
			const { result } = renderHook(() => useDebounce(callback, DEBOUNCE_DELAY));

			// Act:
			act(() => {
				result.current('first');
				result.current('second');
				result.current('third');
			});

			// Assert:
			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith('first');
		});

		it('executes last call after delay expires', () => {
			// Arrange:
			const callback = jest.fn();
			const { result } = renderHook(() => useDebounce(callback, DEBOUNCE_DELAY));

			// Act:
			act(() => {
				result.current('first');
				result.current('second');
				result.current('third');
			});

			act(() => {
				jest.advanceTimersByTime(DEBOUNCE_DELAY);
			});

			// Assert:
			expect(callback).toHaveBeenCalledTimes(2);
			expect(callback).toHaveBeenNthCalledWith(1, 'first');
			expect(callback).toHaveBeenNthCalledWith(2, 'third');
		});

		it('clears pending timer when new call is made within delay', () => {
			// Arrange:
			const callback = jest.fn();
			const { result } = renderHook(() => useDebounce(callback, DEBOUNCE_DELAY));

			// Act:
			act(() => {
				result.current('first');
			});

			act(() => {
				jest.advanceTimersByTime(DEBOUNCE_DELAY - 1);
				result.current('second');
			});

			act(() => {
				jest.advanceTimersByTime(DEBOUNCE_DELAY);
			});

			// Assert:
			expect(callback).toHaveBeenCalledTimes(2);
			expect(callback).toHaveBeenNthCalledWith(1, 'first');
			expect(callback).toHaveBeenNthCalledWith(2, 'second');
		});
	});
});
