import { validateMosaicDivisibility, validateMosaicDuration, validateMosaicSupply } from '@/app/screens/mosaic/utils';

describe('screens/mosaic/utils/validators', () => {
	const runValidatorTest = (createValidator, description, config, expected) => {
		it(description, () => {
			// Arrange:
			const validate = createValidator();

			// Act:
			const result = validate(config.value);

			// Assert:
			expect(result).toBe(expected.result);
		});
	};

	describe('validateMosaicDivisibility', () => {
		const validatorTests = [
			{
				description: 'passes when value is at the minimum',
				config: { value: '0' },
				expected: { result: undefined }
			},
			{
				description: 'passes when value is at the maximum',
				config: { value: '6' },
				expected: { result: undefined }
			},
			{
				description: 'fails when value is above the maximum',
				config: { value: '7' },
				expected: { result: 'validation_error_mosaic_divisibility' }
			},
			{
				description: 'fails when value is negative',
				config: { value: '-1' },
				expected: { result: 'validation_error_mosaic_divisibility' }
			},
			{
				description: 'fails when value is not an integer',
				config: { value: '3.5' },
				expected: { result: 'validation_error_mosaic_divisibility' }
			},
			{
				description: 'fails when value is not a number',
				config: { value: 'abc' },
				expected: { result: 'validation_error_mosaic_divisibility' }
			}
		];

		validatorTests.forEach(test => {
			runValidatorTest(validateMosaicDivisibility, test.description, test.config, test.expected);
		});
	});

	describe('validateMosaicSupply', () => {
		const validatorTests = [
			{
				description: 'passes when value is at the minimum',
				config: { value: '1' },
				expected: { result: undefined }
			},
			{
				description: 'passes when value is at the maximum',
				config: { value: '9999999999' },
				expected: { result: undefined }
			},
			{
				description: 'fails when value is below the minimum',
				config: { value: '0' },
				expected: { result: 'validation_error_mosaic_supply' }
			},
			{
				description: 'fails when value is above the maximum',
				config: { value: '10000000000' },
				expected: { result: 'validation_error_mosaic_supply' }
			},
			{
				description: 'fails when value is not an integer',
				config: { value: '1.5' },
				expected: { result: 'validation_error_mosaic_supply' }
			},
			{
				description: 'fails when value is not a number',
				config: { value: 'abc' },
				expected: { result: 'validation_error_mosaic_supply' }
			}
		];

		validatorTests.forEach(test => {
			runValidatorTest(validateMosaicSupply, test.description, test.config, test.expected);
		});
	});

	describe('validateMosaicDuration', () => {
		const validatorTests = [
			{
				description: 'passes when value is at the minimum',
				config: { value: '1' },
				expected: { result: undefined }
			},
			{
				description: 'passes when value is at the maximum',
				config: { value: '10512000' },
				expected: { result: undefined }
			},
			{
				description: 'fails when value is below the minimum',
				config: { value: '0' },
				expected: { result: 'validation_error_mosaic_duration' }
			},
			{
				description: 'fails when value is above the maximum',
				config: { value: '10512001' },
				expected: { result: 'validation_error_mosaic_duration' }
			},
			{
				description: 'fails when value is not a number',
				config: { value: 'abc' },
				expected: { result: 'validation_error_mosaic_duration' }
			}
		];

		validatorTests.forEach(test => {
			runValidatorTest(validateMosaicDuration, test.description, test.config, test.expected);
		});
	});
});
