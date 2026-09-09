import {
	createTokenDisplayData,
	createTokenExpiration,
	isTokenExpired
} from '@/app/utils';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';

// Constants

const CHAIN_HEIGHT = 150_000;
const BLOCK_GENERATION_TARGET_TIME = 30;
const NETWORK_PROPERTIES = { chainHeight: CHAIN_HEIGHT, blockGenerationTargetTime: BLOCK_GENERATION_TARGET_TIME };
const CHAIN_NAME_SYMBOL = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const CUSTOM_TICKER = 'CTK';

// Token Fixtures

// A token listed in the known-tokens configuration
const knownToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
	.setAmount('100')
	.build();

// A listed token carrying its own ticker, which the listed one overrides
const knownTokenWithOwnTicker = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
	.setTicker(CUSTOM_TICKER)
	.setAmount('100')
	.build();

// A token absent from the known-tokens configuration
const unknownToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 1)
	.setAmount('50')
	.build();

const unknownTokenWithTicker = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 1)
	.setTicker(CUSTOM_TICKER)
	.setAmount('50')
	.build();

const namelessToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 1)
	.setName(null)
	.setAmount('50')
	.build();

const emptyNameToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 1)
	.setName('')
	.setTicker('')
	.setAmount('50')
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
				description: 'resolves the name, ticker and image of a listed token',
				config: { token: knownToken },
				expected: {
					displayData: {
						tokenId: knownToken.id,
						amount: knownToken.amount,
						name: 'Symbol',
						ticker: 'XYM',
						nameText: 'Symbol • XYM',
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
						tokenId: unknownToken.id,
						amount: unknownToken.amount,
						name: unknownToken.name,
						ticker: null,
						nameText: unknownToken.name,
						tickerText: unknownToken.name,
						imageId: null
					}
				}
			},
			{
				description: 'uses the token ticker of an unlisted token',
				config: { token: unknownTokenWithTicker },
				expected: {
					displayData: {
						tokenId: unknownTokenWithTicker.id,
						amount: unknownTokenWithTicker.amount,
						name: unknownTokenWithTicker.name,
						ticker: CUSTOM_TICKER,
						nameText: `${unknownTokenWithTicker.name} • ${CUSTOM_TICKER}`,
						tickerText: CUSTOM_TICKER,
						imageId: null
					}
				}
			},
			{
				description: 'prefers the listed ticker over the token ticker',
				config: { token: knownTokenWithOwnTicker },
				expected: {
					displayData: {
						tokenId: knownTokenWithOwnTicker.id,
						amount: knownTokenWithOwnTicker.amount,
						name: 'Symbol',
						ticker: 'XYM',
						nameText: 'Symbol • XYM',
						tickerText: 'XYM',
						imageId: 'xym'
					}
				}
			},
			{
				description: 'falls back to the token id when the token has no name',
				config: { token: namelessToken },
				expected: {
					displayData: {
						tokenId: namelessToken.id,
						amount: namelessToken.amount,
						name: null,
						ticker: null,
						nameText: namelessToken.id,
						tickerText: namelessToken.id,
						imageId: null
					}
				}
			},
			{
				description: 'treats an empty name and ticker as missing',
				config: { token: emptyNameToken },
				expected: {
					displayData: {
						tokenId: emptyNameToken.id,
						amount: emptyNameToken.amount,
						name: null,
						ticker: null,
						nameText: emptyNameToken.id,
						tickerText: emptyNameToken.id,
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
