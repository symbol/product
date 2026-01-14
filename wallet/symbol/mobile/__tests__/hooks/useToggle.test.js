import { useToggle } from '@/app/hooks/useToggle';
import { act, renderHook } from '@testing-library/react-native';

describe('hooks/useToggle', () => {
	describe('initial value', () => {
		const runInitialValueTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const { result } = renderHook(() => useToggle(config.initialValue));
				const [value] = result.current;

				// Assert:
				expect(value).toBe(expected.value);
			});
		};

		const tests = [
			{
				description: 'initializes with initial value "true"',
				config: { initialValue: true },
				expected: { value: true }
			},
			{
				description: 'initializes with initial value "false"',
				config: { initialValue: false },
				expected: { value: false }
			}
		];

		tests.forEach(test => {
			runInitialValueTest(test.description, test.config, test.expected);
		});
	});

	describe('toggle function', () => {
		it('toggles the value correctly', () => {
			// Arrange:
			const { result } = renderHook(() => useToggle(false));
			const [, toggle] = result.current;

			// Act & Assert:
			act(() => {
				toggle();
			});
			expect(result.current[0]).toBe(true);

			act(() => {
				toggle();
			});
			expect(result.current[0]).toBe(false);
		});
	});
});
