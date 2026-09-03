import { createOperationFeeGroups, createTransactionFeeGroups } from '@/app/screens/bridge/utils/fee-groups';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { TransactionFeeFixtureBuilder } from '__fixtures__/local/TransactionFeeFixtureBuilder';

// Constants

const CHAIN_NAME_SYMBOL = 'symbol';
const CHAIN_NAME_ETHEREUM = 'ethereum';
const NETWORK_IDENTIFIER = 'testnet';
const TIER_LEVEL = 'medium';

// Token Fixtures

const tokenXym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
	.build();

const tokenEth = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 0)
	.build();

const tokenBxym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 1)
	.build();

// Fee Tiers Fixtures (medium tier amounts: symbol '2', ethereum '1')

const symbolFeeTiers = [
	TransactionFeeFixtureBuilder
		.createWithAmounts('1', '2', '3')
		.build()
];

const ethereumFeeTiers = [
	TransactionFeeFixtureBuilder
		.createWithAmounts('0.5', '1', '2', CHAIN_NAME_ETHEREUM)
		.build()
];

// Bridge Stubs

const createPairStub = (targetTokenInfo, targetChainName) => ({
	targetTokenInfo,
	targetWalletController: { chainName: targetChainName }
});

const createBridgeStub = pairs => ({
	steps: pairs.length,
	getPairForStep: stepIndex => pairs[stepIndex]
});

const pairToBxym = createPairStub(tokenBxym, CHAIN_NAME_ETHEREUM);
const pairToXym = createPairStub(tokenXym, CHAIN_NAME_SYMBOL);

describe('screens/bridge/utils/fee-groups', () => {
	describe('createOperationFeeGroups', () => {
		const runOperationFeeGroupsTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const bridge = 'bridge' in config ? config.bridge : createBridgeStub(config.pairs);

				// Act:
				const result = createOperationFeeGroups(config.estimations, bridge);

				// Assert:
				expect(result).toStrictEqual(expected.groups);
			});
		};

		const testCases = [
			[
				'returns no groups without estimations',
				{
					estimations: null,
					pairs: [pairToXym]
				},
				{ groups: [] }
			],
			[
				'returns no groups without a bridge',
				{
					estimations: [{ bridgeFee: '0.75' }],
					bridge: null
				},
				{ groups: [] }
			],
			[
				'returns no groups when a step estimation failed',
				{
					estimations: [
						{ bridgeFee: '2.5' },
						{ bridgeFee: null, error: { code: 'amount_low' } }
					],
					pairs: [pairToBxym, pairToXym]
				},
				{ groups: [] }
			],
			[
				'returns one group with the unchanged amount for a single step',
				{
					estimations: [{ bridgeFee: '0.750000' }],
					pairs: [pairToXym]
				},
				{
					groups: [
						{ amount: '0.750000', tokenName: tokenXym.name, chainName: CHAIN_NAME_SYMBOL }
					]
				}
			],
			[
				'keeps fees in different tokens in separate groups in step order',
				{
					estimations: [{ bridgeFee: '2.5' }, { bridgeFee: '0.75' }],
					pairs: [pairToBxym, pairToXym]
				},
				{
					groups: [
						{ amount: '2.5', tokenName: tokenBxym.name, chainName: CHAIN_NAME_ETHEREUM },
						{ amount: '0.75', tokenName: tokenXym.name, chainName: CHAIN_NAME_SYMBOL }
					]
				}
			],
			[
				'adds fees in the same token into one group',
				{
					estimations: [{ bridgeFee: '1.5' }, { bridgeFee: '0.5' }],
					pairs: [pairToXym, pairToXym]
				},
				{
					groups: [
						{ amount: '2', tokenName: tokenXym.name, chainName: CHAIN_NAME_SYMBOL }
					]
				}
			],
			[
				'skips a step without a bridge fee',
				{
					estimations: [{ bridgeFee: null }, { bridgeFee: '0.75' }],
					pairs: [pairToBxym, pairToXym]
				},
				{
					groups: [
						{ amount: '0.75', tokenName: tokenXym.name, chainName: CHAIN_NAME_SYMBOL }
					]
				}
			]
		];

		testCases.forEach(([description, config, expected]) => runOperationFeeGroupsTest(description, config, expected));
	});

	describe('createTransactionFeeGroups', () => {
		const symbolStepFees = {
			chainName: CHAIN_NAME_SYMBOL,
			networkCurrency: tokenXym,
			feeTiers: symbolFeeTiers
		};

		const ethereumStepFees = {
			chainName: CHAIN_NAME_ETHEREUM,
			networkCurrency: tokenEth,
			feeTiers: ethereumFeeTiers
		};

		const runTransactionFeeGroupsTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = createTransactionFeeGroups(config.stepFees, TIER_LEVEL);

				// Assert:
				expect(result).toStrictEqual(expected.groups);
			});
		};

		const testCases = [
			[
				'returns no groups for empty input',
				{ stepFees: [] },
				{ groups: [] }
			],
			[
				'skips a step without a network currency',
				{
					stepFees: [{ chainName: CHAIN_NAME_SYMBOL, networkCurrency: null, feeTiers: symbolFeeTiers }]
				},
				{ groups: [] }
			],
			[
				'returns one group with the tier total for a single step',
				{ stepFees: [symbolStepFees] },
				{
					groups: [
						{ amount: '2', tokenName: tokenXym.name, chainName: CHAIN_NAME_SYMBOL }
					]
				}
			],
			[
				'counts a step without loaded fee tiers as zero',
				{
					stepFees: [
						{ chainName: CHAIN_NAME_SYMBOL, networkCurrency: tokenXym, feeTiers: null },
						symbolStepFees
					]
				},
				{
					groups: [
						{ amount: '2', tokenName: tokenXym.name, chainName: CHAIN_NAME_SYMBOL }
					]
				}
			],
			[
				'adds the fees of steps paid in the same currency',
				{ stepFees: [symbolStepFees, symbolStepFees] },
				{
					groups: [
						{ amount: '4', tokenName: tokenXym.name, chainName: CHAIN_NAME_SYMBOL }
					]
				}
			],
			[
				'keeps fees on different chains in separate groups in step order',
				{ stepFees: [ethereumStepFees, symbolStepFees] },
				{
					groups: [
						{ amount: '1', tokenName: tokenEth.name, chainName: CHAIN_NAME_ETHEREUM },
						{ amount: '2', tokenName: tokenXym.name, chainName: CHAIN_NAME_SYMBOL }
					]
				}
			]
		];

		testCases.forEach(([description, config, expected]) => runTransactionFeeGroupsTest(description, config, expected));
	});
});
