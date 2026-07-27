import { useEventCallback } from '@/app/hooks';
import { HookTester } from '__tests__/HookTester';

// Constants

const firstArgument = 'first argument';
const secondArgument = 'second argument';

describe('hooks/useEventCallback', () => {
	describe('callback invocation', () => {
		it('calls the latest callback', () => {
			// Arrange:
			const initialCallback = jest.fn();
			const latestCallback = jest.fn();
			const hookTester = new HookTester(useEventCallback, [initialCallback]);

			// Act:
			hookTester.updateProps([latestCallback]);
			hookTester.currentResult();

			// Assert:
			expect(latestCallback).toHaveBeenCalledTimes(1);
			expect(initialCallback).not.toHaveBeenCalled();
		});

		it('passes the arguments and returns the value of the latest callback', () => {
			// Arrange:
			const expectedReturnValue = 'return value';
			const callback = jest.fn().mockReturnValue(expectedReturnValue);
			const hookTester = new HookTester(useEventCallback, [callback]);

			// Act:
			const returnValue = hookTester.currentResult(firstArgument, secondArgument);

			// Assert:
			expect(callback).toHaveBeenCalledWith(firstArgument, secondArgument);
			expect(returnValue).toBe(expectedReturnValue);
		});
	});

	describe('callback identity', () => {
		it('keeps the same callback identity when the callback changes', () => {
			// Arrange:
			const hookTester = new HookTester(useEventCallback, [jest.fn()]);
			const initialResult = hookTester.currentResult;

			// Act:
			hookTester.updateProps([jest.fn()]);

			// Assert:
			expect(hookTester.currentResult).toBe(initialResult);
		});
	});
});
