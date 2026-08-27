import { useTokenDisplayData } from '@/app/hooks';
import * as useWalletControllerModule from '@/app/hooks/useWalletController';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { HookTester } from '__tests__/HookTester';
import { mockWalletController } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';

// Real entry from src/config/known-tokens.json (symbol/testnet, id 72C0212E67A08BCE)
const KNOWN_TOKEN_NAME = 'Symbol';
const KNOWN_TOKEN_TICKER = 'XYM';
const KNOWN_TOKEN_IMAGE_ID = 'xym';
const RENAMED_TOKEN_NAME = 'custom.renamed';

// Token Fixtures

const knownToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setAmount('100')
	.build();

const customToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setAmount('50')
	.build();

const namelessToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setName(null)
	.setAmount('25')
	.build();

describe('hooks/useTokenDisplayData', () => {
	beforeEach(() => {
		mockWalletController();
	});

	describe('label resolution', () => {
		const runLabelResolutionTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const hookTester = new HookTester(useTokenDisplayData, [config.token]);

				// Assert:
				hookTester.expectResult({
					tokenId: config.token.id,
					amount: config.token.amount,
					name: expected.name,
					ticker: expected.ticker,
					imageId: expected.imageId
				});
			});
		};

		const labelResolutionTests = [
			{
				description: 'resolves the known token name, ticker and image',
				config: { token: knownToken },
				expected: {
					name: KNOWN_TOKEN_NAME,
					ticker: KNOWN_TOKEN_TICKER,
					imageId: KNOWN_TOKEN_IMAGE_ID
				}
			},
			{
				description: 'falls back to the token name for an unknown token',
				config: { token: customToken },
				expected: { name: customToken.name, ticker: null, imageId: null }
			},
			{
				description: 'falls back to the token id when the token has no name',
				config: { token: namelessToken },
				expected: { name: namelessToken.id, ticker: null, imageId: null }
			}
		];

		labelResolutionTests.forEach(test => {
			runLabelResolutionTest(test.description, test.config, test.expected);
		});
	});

	describe('input shape', () => {
		it('returns a single object for a single token', () => {
			// Act:
			const hookTester = new HookTester(useTokenDisplayData, [knownToken]);

			// Assert:
			expect(Array.isArray(hookTester.currentResult)).toBe(false);
			expect(hookTester.currentResult.tokenId).toBe(knownToken.id);
		});

		it('returns a list matching the input order for a token list', () => {
			// Arrange:
			const expectedNames = [KNOWN_TOKEN_NAME, customToken.name];

			// Act:
			const hookTester = new HookTester(useTokenDisplayData, [[knownToken, customToken]]);

			// Assert:
			expect(hookTester.currentResult).toHaveLength(2);
			expect(hookTester.currentResult.map(displayData => displayData.name)).toStrictEqual(expectedNames);
		});

		it('returns an empty list for an empty token list', () => {
			// Act:
			const hookTester = new HookTester(useTokenDisplayData, [[]]);

			// Assert:
			hookTester.expectResult([]);
		});
	});

	describe('memoization', () => {
		it('returns the same result for a new list instance with the same content', () => {
			// Arrange:
			const hookTester = new HookTester(useTokenDisplayData, [[knownToken, customToken]]);
			const firstResult = hookTester.currentResult;

			// Act:
			hookTester.updateProps([[{ ...knownToken }, { ...customToken }]]);

			// Assert:
			expect(hookTester.currentResult).toBe(firstResult);
		});

		it('recomputes when a token amount changes', () => {
			// Arrange:
			const hookTester = new HookTester(useTokenDisplayData, [[knownToken]]);
			const firstResult = hookTester.currentResult;

			// Act:
			hookTester.updateProps([[{ ...knownToken, amount: '200' }]]);

			// Assert:
			expect(hookTester.currentResult).not.toBe(firstResult);
			expect(hookTester.currentResult[0].amount).toBe('200');
		});

		it('recomputes when a token name changes', () => {
			// Arrange:
			const hookTester = new HookTester(useTokenDisplayData, [[customToken]]);
			const firstResult = hookTester.currentResult;

			// Act:
			hookTester.updateProps([[{ ...customToken, name: RENAMED_TOKEN_NAME }]]);

			// Assert:
			expect(hookTester.currentResult).not.toBe(firstResult);
			expect(hookTester.currentResult[0].name).toBe(RENAMED_TOKEN_NAME);
		});
	});

	describe('chain scoping', () => {
		it('forwards the chainName to the wallet controller hook', () => {
			// Act:
			new HookTester(useTokenDisplayData, [[knownToken], 'ethereum']);

			// Assert:
			expect(useWalletControllerModule.useWalletController).toHaveBeenCalledWith('ethereum');
		});
	});
});
