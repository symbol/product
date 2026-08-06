import { isTokenExpired } from '@/app/utils';

// Constants

const CHAIN_HEIGHT = 150_000;

describe('utils/token', () => {
	describe('isTokenExpired()', () => {
		const runIsTokenExpiredTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const token = {
					endHeight: config.endHeight,
					isUnlimitedDuration: config.isUnlimitedDuration
				};

				// Act:
				const result = isTokenExpired(token, CHAIN_HEIGHT);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const isTokenExpiredTests = [
			{
				description: 'returns false when the token has unlimited duration',
				config: { endHeight: CHAIN_HEIGHT - 1, isUnlimitedDuration: true },
				expected: { result: false }
			},
			{
				description: 'returns false when the token has no end height',
				config: { endHeight: 0, isUnlimitedDuration: false },
				expected: { result: false }
			},
			{
				description: 'returns false when the end height is above the chain height',
				config: { endHeight: CHAIN_HEIGHT + 1, isUnlimitedDuration: false },
				expected: { result: false }
			},
			{
				description: 'returns true when the end height equals the chain height',
				config: { endHeight: CHAIN_HEIGHT, isUnlimitedDuration: false },
				expected: { result: true }
			},
			{
				description: 'returns true when the end height is below the chain height',
				config: { endHeight: CHAIN_HEIGHT - 1, isUnlimitedDuration: false },
				expected: { result: true }
			}
		];

		isTokenExpiredTests.forEach(test => {
			runIsTokenExpiredTest(test.description, test.config, test.expected);
		});
	});
});
