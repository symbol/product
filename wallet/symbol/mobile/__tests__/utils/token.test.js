import { createTokenDisplayData, isTokenExpired } from '@/app/utils';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';

// Constants

const CHAIN_HEIGHT = 150_000;
const CHAIN_NAME_SYMBOL = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';

// Token Fixtures

// A token listed in the known-tokens configuration
const knownToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
	.build();

// A token absent from the known-tokens configuration
const unknownToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 1)
	.build();

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

	describe('createTokenDisplayData()', () => {
		const runCreateTokenDisplayDataTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = createTokenDisplayData(config.token, CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER);

				// Assert:
				expect(result).toStrictEqual(expected.displayData);
			});
		};

		const createTokenDisplayDataTests = [
			{
				description: 'resolves the name, ticker, ticker text and image of a listed token',
				config: { token: knownToken },
				expected: {
					displayData: {
						name: 'Symbol • XYM',
						ticker: 'XYM',
						tickerText: 'XYM',
						imageId: 'xym'
					}
				}
			},
			{
				description: 'falls back to the token name for an unlisted token',
				config: { token: unknownToken },
				expected: {
					displayData: {
						name: unknownToken.name,
						ticker: null,
						tickerText: unknownToken.name,
						imageId: null
					}
				}
			}
		];

		createTokenDisplayDataTests.forEach(test => {
			runCreateTokenDisplayDataTest(test.description, test.config, test.expected);
		});
	});
});
