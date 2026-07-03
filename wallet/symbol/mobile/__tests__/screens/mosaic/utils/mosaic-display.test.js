import { calculateMosaicDurationDays } from '@/app/screens/mosaic/utils';

describe('screens/mosaic/utils/mosaic-display', () => {
	describe('calculateMosaicDurationDays', () => {
		const runCalculateDurationDaysTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = calculateMosaicDurationDays(config.duration, config.blockGenerationTargetTime);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const calculateDurationDaysTests = [
			{
				description: 'returns one day for a day worth of 30 second blocks',
				config: { duration: '2880', blockGenerationTargetTime: '30' },
				expected: { result: 1 }
			},
			{
				description: 'returns the maximum rental period for the maximum duration',
				config: { duration: 10512000, blockGenerationTargetTime: 30 },
				expected: { result: 3650 }
			},
			{
				description: 'returns zero for a zero duration',
				config: { duration: '0', blockGenerationTargetTime: '30' },
				expected: { result: 0 }
			},
			{
				description: 'rounds the result to the nearest day',
				config: { duration: '100', blockGenerationTargetTime: '15' },
				expected: { result: 0 }
			}
		];

		calculateDurationDaysTests.forEach(test => {
			runCalculateDurationDaysTest(test.description, test.config, test.expected);
		});
	});
});
