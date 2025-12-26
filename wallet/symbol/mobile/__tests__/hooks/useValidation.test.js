import { useValidation } from '@/app/hooks/useValidation';
import { renderHook } from '@testing-library/react-native';

describe('hooks/useValidation', () => {
	const createPassingValidator = () => () => null;
	const createFailingValidator = errorMessage => () => errorMessage;

	describe('validation without formatResult', () => {
		const runValidationTest = (config, expected) => {
			it(`returns ${expected.result} when ${config.description}`, () => {
				// Act:
				const { result } = renderHook(() => useValidation(config.value, config.validators));

				// Assert:
				expect(result.current).toBe(expected.result);
			});
		};

		const tests = [
			{
				description: 'all validators pass',
				value: 'valid',
				validators: [createPassingValidator(), createPassingValidator()],
				expected: { result: undefined }
			},
			{
				description: 'first validator fails',
				value: 'invalid',
				validators: [createFailingValidator('error_first'), createPassingValidator()],
				expected: { result: 'error_first' }
			},
			{
				description: 'second validator fails',
				value: 'invalid',
				validators: [createPassingValidator(), createFailingValidator('error_second')],
				expected: { result: 'error_second' }
			},
			{
				description: 'multiple validators fail (returns first error)',
				value: 'invalid',
				validators: [createFailingValidator('error_first'), createFailingValidator('error_second')],
				expected: { result: 'error_first' }
			},
			{
				description: 'no validators provided',
				value: 'any',
				validators: [],
				expected: { result: undefined }
			}
		];

		tests.forEach(test => {
			runValidationTest(
				{ value: test.value, validators: test.validators, description: test.description },
				test.expected
			);
		});
	});

	describe('validation with formatResult', () => {
		const runFormattedValidationTest = (config, expected) => {
			it(`returns ${expected.result} when ${config.description}`, () => {
				// Arrange:
				const formatResult = key => `formatted_${key}`;

				// Act:
				const { result } = renderHook(() => useValidation(config.value, config.validators, formatResult));

				// Assert:
				expect(result.current).toBe(expected.result);
			});
		};

		const tests = [
			{
				description: 'validator fails and formatResult is applied',
				value: 'invalid',
				validators: [createFailingValidator('error_message')],
				expected: { result: 'formatted_error_message' }
			},
			{
				description: 'all validators pass (formatResult not applied)',
				value: 'valid',
				validators: [createPassingValidator()],
				expected: { result: undefined }
			}
		];

		tests.forEach(test => {
			runFormattedValidationTest(
				{ value: test.value, validators: test.validators, description: test.description },
				test.expected
			);
		});
	});

	describe('reactivity', () => {
		it('updates result when value changes', () => {
			// Arrange:
			const validator = value => (value === 'invalid' ? 'error_invalid' : null);
			let currentValue = 'valid';

			// Act:
			const { result, rerender } = renderHook(() => useValidation(currentValue, [validator]));

			// Assert:
			expect(result.current).toBe(undefined);

			// Act:
			currentValue = 'invalid';
			rerender();

			// Assert:
			expect(result.current).toBe('error_invalid');
		});
	});
});
