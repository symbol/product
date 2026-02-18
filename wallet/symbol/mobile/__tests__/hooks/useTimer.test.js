import { useTimer } from '@/app/hooks/useTimer';
import { act, renderHook } from '@testing-library/react-native';

const DEFAULT_INTERVAL = 1000;

describe('hooks/useTimer', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('timer activation', () => {
		it('calls callback at specified interval when active', () => {
			// Arrange:
			const callback = jest.fn();

			// Act:
			renderHook(() => useTimer({ callback, interval: DEFAULT_INTERVAL, isActive: true }));

			act(() => {
				jest.advanceTimersByTime(DEFAULT_INTERVAL);
			});

			// Assert:
			expect(callback).toHaveBeenCalledTimes(1);

			// Act:
			act(() => {
				jest.advanceTimersByTime(DEFAULT_INTERVAL);
			});

			// Assert:
			expect(callback).toHaveBeenCalledTimes(2);
		});

		it('does not call callback when inactive', () => {
			// Arrange:
			const callback = jest.fn();

			// Act:
			renderHook(() => useTimer({ callback, interval: DEFAULT_INTERVAL, isActive: false }));

			act(() => {
				jest.advanceTimersByTime(DEFAULT_INTERVAL * 3);
			});

			// Assert:
			expect(callback).not.toHaveBeenCalled();
		});

		it('stops calling callback when timer becomes inactive', () => {
			// Arrange:
			const callback = jest.fn();
			const { rerender } = renderHook(
				({ isActive }) => useTimer({ callback, interval: DEFAULT_INTERVAL, isActive }),
				{ initialProps: { isActive: true } }
			);

			act(() => {
				jest.advanceTimersByTime(DEFAULT_INTERVAL);
			});
			expect(callback).toHaveBeenCalledTimes(1);

			// Act:
			rerender({ isActive: false });

			act(() => {
				jest.advanceTimersByTime(DEFAULT_INTERVAL * 3);
			});

			// Assert:
			expect(callback).toHaveBeenCalledTimes(1);
		});
	});

	describe('interval validation', () => {
		const runIntervalValidationTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const callback = jest.fn();

				// Act & Assert:
				expect(() => {
					renderHook(() => useTimer({ callback, interval: config.interval, isActive: true }));
				}).toThrow(expected.error);
			});
		};

		const tests = [
			{
				description: 'throws error when interval is zero',
				config: { interval: 0 },
				expected: { error: 'Interval must be a positive number' }
			},
			{
				description: 'throws error when interval is negative',
				config: { interval: -100 },
				expected: { error: 'Interval must be a positive number' }
			},
			{
				description: 'throws error when interval is undefined',
				config: { interval: undefined },
				expected: { error: 'Interval must be a positive number' }
			},
			{
				description: 'throws error when interval is null',
				config: { interval: null },
				expected: { error: 'Interval must be a positive number' }
			}
		];

		tests.forEach(test => {
			runIntervalValidationTest(test.description, test.config, test.expected);
		});
	});

	describe('callback update', () => {
		it('uses updated callback after rerender', () => {
			// Arrange:
			const callback1 = jest.fn();
			const callback2 = jest.fn();
			const { rerender } = renderHook(
				({ callback }) => useTimer({ callback, interval: DEFAULT_INTERVAL, isActive: true }),
				{ initialProps: { callback: callback1 } }
			);

			// Act:
			rerender({ callback: callback2 });

			act(() => {
				jest.advanceTimersByTime(DEFAULT_INTERVAL);
			});

			// Assert:
			expect(callback1).not.toHaveBeenCalled();
			expect(callback2).toHaveBeenCalledTimes(1);
		});
	});

	describe('dependencies change', () => {
		it('restarts timer when dependencies change', () => {
			// Arrange:
			const callback = jest.fn();
			const { rerender } = renderHook(
				({ dependency }) => useTimer({ 
					callback, 
					interval: DEFAULT_INTERVAL, 
					isActive: true, 
					dependencies: [dependency] 
				}),
				{ initialProps: { dependency: 'initial' } }
			);

			act(() => {
				jest.advanceTimersByTime(DEFAULT_INTERVAL / 2);
			});

			// Act:
			rerender({ dependency: 'updated' });

			act(() => {
				jest.advanceTimersByTime(DEFAULT_INTERVAL / 2);
			});

			// Assert:
			expect(callback).not.toHaveBeenCalled();

			// Act:
			act(() => {
				jest.advanceTimersByTime(DEFAULT_INTERVAL / 2);
			});

			// Assert:
			expect(callback).toHaveBeenCalledTimes(1);
		});
	});

	describe('cleanup', () => {
		it('clears interval on unmount', () => {
			// Arrange:
			const callback = jest.fn();
			const { unmount } = renderHook(() => 
				useTimer({ callback, interval: DEFAULT_INTERVAL, isActive: true }));

			// Act:
			unmount();

			act(() => {
				jest.advanceTimersByTime(DEFAULT_INTERVAL * 3);
			});

			// Assert:
			expect(callback).not.toHaveBeenCalled();
		});
	});
});
