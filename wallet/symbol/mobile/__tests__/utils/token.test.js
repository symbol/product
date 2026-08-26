import { createTokenExpiration, formatTokenNameText, isTokenExpired } from '@/app/utils';

// Constants

const CHAIN_HEIGHT = 150_000;
const BLOCK_GENERATION_TARGET_TIME = 30;
const NETWORK_PROPERTIES = { chainHeight: CHAIN_HEIGHT, blockGenerationTargetTime: BLOCK_GENERATION_TARGET_TIME };

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

	describe('formatTokenNameText()', () => {
		const runFormatTokenNameTextTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = formatTokenNameText(config.name, config.ticker);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const formatTokenNameTextTests = [
			{
				description: 'appends the ticker to the name when a ticker is provided',
				config: { name: 'Symbol', ticker: 'XYM' },
				expected: { result: 'Symbol • XYM' }
			},
			{
				description: 'returns the name alone when the ticker is null',
				config: { name: 'Symbol', ticker: null },
				expected: { result: 'Symbol' }
			},
			{
				description: 'returns the name alone when the ticker is undefined',
				config: { name: 'Symbol', ticker: undefined },
				expected: { result: 'Symbol' }
			}
		];

		formatTokenNameTextTests.forEach(test => {
			runFormatTokenNameTextTest(test.description, test.config, test.expected);
		});
	});

	describe('createTokenExpiration()', () => {
		const runCreateTokenExpirationTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const token = {
					startHeight: config.startHeight,
					endHeight: config.endHeight,
					isUnlimitedDuration: config.isUnlimitedDuration
				};

				// Act:
				const result = createTokenExpiration(token, NETWORK_PROPERTIES);

				// Assert:
				expect(result).toStrictEqual(expected.result);
			});
		};

		const createTokenExpirationTests = [
			{
				description: 'returns the expiration inputs for a token with a finite duration',
				config: { startHeight: 1_000, endHeight: 200_000, isUnlimitedDuration: false },
				expected: {
					result: {
						startHeight: 1_000,
						endHeight: 200_000,
						chainHeight: CHAIN_HEIGHT,
						blockGenerationTargetTime: BLOCK_GENERATION_TARGET_TIME
					}
				}
			},
			{
				description: 'returns null when the token has no end height',
				config: { startHeight: 1_000, endHeight: 0, isUnlimitedDuration: false },
				expected: { result: null }
			},
			{
				description: 'returns null when the token has unlimited duration',
				config: { startHeight: 1_000, endHeight: 200_000, isUnlimitedDuration: true },
				expected: { result: null }
			}
		];

		createTokenExpirationTests.forEach(test => {
			runCreateTokenExpirationTest(test.description, test.config, test.expected);
		});
	});
});
