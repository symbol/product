import { useValidation } from '@/app/hooks/useValidation';
import { renderHook } from '@testing-library/react-native';

describe('hooks/useValidation', () => {
	const createPassingValidator = () => () => null;
	const createFailingValidator = errorMessage => () => errorMessage;

	describe('validation without formatResult', () => {
		const runValidationTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const { result } = renderHook(() => useValidation(config.value, config.validators));

				// Assert:
				expect(result.current).toBe(expected.result);
			});
		};

		const tests = [
			{
				description: 'returns undefined when all validators pass',
				config: {
					value: 'valid',
					validators: [createPassingValidator(), createPassingValidator()]
				},
				expected: { result: undefined }
			},
			{
				description: 'returns error_first when first validator fails',
				config: {
					value: 'invalid',
					validators: [createFailingValidator('error_first'), createPassingValidator()]
				},
				expected: { result: 'error_first' }
			},
			{
				description: 'returns error_second when second validator fails',
				config: {
					value: 'invalid',
					validators: [createPassingValidator(), createFailingValidator('error_second')]
				},
				expected: { result: 'error_second' }
			},
			{
				description: 'returns first error when multiple validators fail',
				config: {
					value: 'invalid',
					validators: [createFailingValidator('error_first'), createFailingValidator('error_second')]
				},
				expected: { result: 'error_first' }
			},
			{
				description: 'returns undefined when no validators provided',
				config: {
					value: 'any',
					validators: []
				},
				expected: { result: undefined }
			}
		];

		tests.forEach(test => {
			runValidationTest(test.description, test.config, test.expected);
		});
	});

	describe('validation with formatResult', () => {
		const runFormattedValidationTest = (description, config, expected) => {
			it(description, () => {
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
				description: 'returns formatted result when validator fails and formatResult is applied',
				config: {
					value: 'invalid',
					validators: [createFailingValidator('error_message')]
				},
				expected: { result: 'formatted_error_message' }
			},
			{
				description: 'returns undefined when all validators pass (formatResult not applied)',
				config: {
					value: 'valid',
					validators: [createPassingValidator()]
				},
				expected: { result: undefined }
			}
		];

		tests.forEach(test => {
			runFormattedValidationTest(test.description, test.config, test.expected);
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
