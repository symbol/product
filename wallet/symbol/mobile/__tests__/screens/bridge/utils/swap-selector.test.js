import { createSwapSelectorViewModel, createSwapSideKey } from '@/app/screens/bridge/utils/swap-selector';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';

// Constants

const CHAIN_NAME_SYMBOL = 'symbol';
const CHAIN_NAME_ETHEREUM = 'ethereum';
const NETWORK_IDENTIFIER = 'testnet';

// Token Fixtures

// Tokens listed in the known-tokens configuration
const tokenXym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
	.setAmount('100')
	.build();

const tokenBxym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 1)
	.setAmount('99')
	.build();

// A token absent from the known-tokens configuration
const tokenUnlisted = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 1)
	.setAmount('5')
	.build();

// Swap Side Fixtures

const createSwapSide = (token, chainName) => ({
	token,
	chainName,
	networkIdentifier: NETWORK_IDENTIFIER,
	walletController: {}
});

const sideXym = createSwapSide(tokenXym, CHAIN_NAME_SYMBOL);
const sideBxym = createSwapSide(tokenBxym, CHAIN_NAME_ETHEREUM);
const sideUnlisted = createSwapSide(tokenUnlisted, CHAIN_NAME_SYMBOL);

// Expected Options

const expectedOptionXym = {
	key: `${CHAIN_NAME_SYMBOL}|${tokenXym.id}`,
	nameText: 'Symbol • XYM',
	imageId: 'xym',
	chainName: CHAIN_NAME_SYMBOL,
	amount: '100',
	side: sideXym
};

const expectedOptionBxym = {
	key: `${CHAIN_NAME_ETHEREUM}|${tokenBxym.id}`,
	nameText: 'Bridged XYM • bXYM',
	imageId: 'bxym',
	chainName: CHAIN_NAME_ETHEREUM,
	amount: '99',
	side: sideBxym
};

const expectedOptionUnlisted = {
	key: `${CHAIN_NAME_SYMBOL}|${tokenUnlisted.id}`,
	nameText: tokenUnlisted.name,
	imageId: null,
	chainName: CHAIN_NAME_SYMBOL,
	amount: '5',
	side: sideUnlisted
};

describe('screens/bridge/utils/swap-selector', () => {
	describe('createSwapSideKey()', () => {
		it('joins the chain name and the token id', () => {
			// Act:
			const result = createSwapSideKey(sideXym);

			// Assert:
			expect(result).toBe(`${CHAIN_NAME_SYMBOL}|${tokenXym.id}`);
		});
	});

	describe('createSwapSelectorViewModel()', () => {
		const runCreateSwapSelectorViewModelTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = createSwapSelectorViewModel({
					source: config.source,
					target: config.target,
					sourceList: config.sourceList,
					targetList: config.targetList
				});

				// Assert:
				expect(result).toStrictEqual(expected.viewModel);
			});
		};

		const createSwapSelectorViewModelTests = [
			{
				description: 'returns no options while nothing is selected',
				config: {
					source: null,
					target: null,
					sourceList: [],
					targetList: []
				},
				expected: {
					viewModel: {
						source: null,
						target: null,
						sourceOptions: [],
						targetOptions: []
					}
				}
			},
			{
				description: 'resolves the name, avatar and balance of the selected sides and their options',
				config: {
					source: sideXym,
					target: sideBxym,
					sourceList: [sideXym, sideUnlisted],
					targetList: [sideBxym]
				},
				expected: {
					viewModel: {
						source: expectedOptionXym,
						target: expectedOptionBxym,
						sourceOptions: [expectedOptionXym, expectedOptionUnlisted],
						targetOptions: [expectedOptionBxym]
					}
				}
			},
			{
				description: 'names an unlisted token by its name without an avatar',
				config: {
					source: sideUnlisted,
					target: null,
					sourceList: [sideUnlisted],
					targetList: []
				},
				expected: {
					viewModel: {
						source: expectedOptionUnlisted,
						target: null,
						sourceOptions: [expectedOptionUnlisted],
						targetOptions: []
					}
				}
			}
		];

		createSwapSelectorViewModelTests.forEach(test =>
			runCreateSwapSelectorViewModelTest(test.description, test.config, test.expected));
	});
});
