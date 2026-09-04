import { useBridgeAmount } from '@/app/screens/bridge/hooks/useBridgeAmount';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { TransactionFeeFixtureBuilder } from '__fixtures__/local/TransactionFeeFixtureBuilder';
import { HookTester } from '__tests__/HookTester';
import { runHookContractTest } from '__tests__/hook-tests';
import { createWalletControllerMock } from '__tests__/mock-helpers';
import { act } from '@testing-library/react-native';

// Constants

const CHAIN_NAME = 'symbol';
const CHAIN_NAME_ETHEREUM = 'ethereum';
const NETWORK_IDENTIFIER = 'testnet';
const TRANSACTION_FEE_TIER_LEVEL = 'medium';

// Fixtures

const account = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const nativeToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setAmount('100')
	.build();

const nonNativeToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setAmount('150')
	.build();

const networkCurrency = {
	id: nativeToken.id,
	mosaicId: nativeToken.id,
	divisibility: nativeToken.divisibility,
	name: nativeToken.name
};

const networkProperties = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setNetworkCurrency(networkCurrency)
	.build();

const walletControllerWithNetwork = createWalletControllerMock({
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	networkProperties,
	currentAccount: account
});

const walletControllerWithoutNetworkCurrency = createWalletControllerMock({
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	networkProperties: { networkCurrency: null },
	currentAccount: account
});

const sourceNative = {
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	token: nativeToken,
	walletController: walletControllerWithNetwork
};

const sourceNonNative = {
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	token: nonNativeToken,
	walletController: walletControllerWithNetwork
};

const sourceWithoutNetworkCurrency = {
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	token: nativeToken,
	walletController: walletControllerWithoutNetworkCurrency
};

// Ethereum Fixtures

// bXYM has 6 decimals while ETH, the chain's native currency, has 18
const ethereumAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 0)
	.build();

const ethereumNativeToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 0)
	.setAmount('2')
	.build();

const ethereumNonNativeToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 1)
	.setAmount('500')
	.build();

const ethereumNetworkProperties = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER)
	.build();

const ethereumWalletController = createWalletControllerMock({
	chainName: CHAIN_NAME_ETHEREUM,
	networkIdentifier: NETWORK_IDENTIFIER,
	networkProperties: ethereumNetworkProperties,
	currentAccount: ethereumAccount
});

const sourceEthereumNative = {
	chainName: CHAIN_NAME_ETHEREUM,
	networkIdentifier: NETWORK_IDENTIFIER,
	token: ethereumNativeToken,
	walletController: ethereumWalletController
};

const sourceEthereumNonNative = {
	chainName: CHAIN_NAME_ETHEREUM,
	networkIdentifier: NETWORK_IDENTIFIER,
	token: ethereumNonNativeToken,
	walletController: ethereumWalletController
};

// Step Fees Fixtures

// Paid in the source chain's native currency, medium tier 2
const nativeCurrencyFeeTiers = [
	TransactionFeeFixtureBuilder
		.createWithAmounts('1', '2', '3')
		.build()
];

// Paid on another chain, medium tier 1
const ethereumFeeTiers = [
	TransactionFeeFixtureBuilder
		.createWithAmounts('0.5', '1', '2', CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER)
		.build()
];

const createStepFees = (stepIndex, chainName, feeTiers) => ({
	stepIndex,
	chainName,
	networkIdentifier: NETWORK_IDENTIFIER,
	feeTiers
});

const firstStepFees = createStepFees(0, CHAIN_NAME, nativeCurrencyFeeTiers);
const firstStepFeesNotLoaded = createStepFees(0, CHAIN_NAME, null);
const secondStepFees = createStepFees(1, CHAIN_NAME, nativeCurrencyFeeTiers);
const secondStepFeesNotLoaded = createStepFees(1, CHAIN_NAME, null);
const secondStepFeesOnEthereum = createStepFees(1, CHAIN_NAME_ETHEREUM, ethereumFeeTiers);

// Hook Helpers

const createHookParams = overrides => ({
	source: sourceNative,
	stepFees: [firstStepFees],
	transactionFeeTierLevel: TRANSACTION_FEE_TIER_LEVEL,
	...overrides
});

describe('hooks/useBridgeAmount', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	runHookContractTest(useBridgeAmount, {
		props: [createHookParams()],
		contract: {
			amount: 'string',
			amountInput: 'string',
			isAmountValid: 'boolean',
			availableBalance: 'string',
			changeAmount: 'function',
			changeAmountValidity: 'function',
			reset: 'function'
		}
	});

	describe('initialization', () => {
		const runInitializationTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const params = createHookParams(config);

				// Act:
				const hookTester = new HookTester(useBridgeAmount, [params]);

				// Assert:
				expect(hookTester.currentResult.amount).toBe(expected.amount);
				expect(hookTester.currentResult.amountInput).toBe(expected.amountInput);
				expect(hookTester.currentResult.isAmountValid).toBe(expected.isAmountValid);
				expect(hookTester.currentResult.availableBalance).toBe(expected.availableBalance);
			});
		};

		const initializationTests = [
			{
				description: 'initializes with native currency balance minus fee',
				config: {
					source: sourceNative
				},
				expected: {
					amount: '0',
					amountInput: '0',
					isAmountValid: true,
					availableBalance: '98'
				}
			},
			{
				description: 'initializes with zero available balance when native currency is missing',
				config: {
					source: sourceWithoutNetworkCurrency
				},
				expected: {
					amount: '0',
					amountInput: '0',
					isAmountValid: true,
					availableBalance: '0'
				}
			},
			{
				description: 'initializes non-native source with full available balance',
				config: {
					source: sourceNonNative
				},
				expected: {
					amount: '0',
					amountInput: '0',
					isAmountValid: true,
					availableBalance: '150'
				}
			}
		];

		initializationTests.forEach(test => {
			runInitializationTest(test.description, test.config, test.expected);
		});
	});

	describe('amount', () => {
		const runAmountTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const params = createHookParams({ source: config.source });
				const hookTester = new HookTester(useBridgeAmount, [params]);

				// Act:
				act(() => {
					hookTester.currentResult.changeAmount(config.amountInput);
				});

				// Assert:
				expect(hookTester.currentResult.amount).toBe(expected.amount);
				expect(hookTester.currentResult.amountInput).toBe(config.amountInput);
			});
		};

		const amountTests = [
			{
				description: 'truncates the input to the decimals of a native source token',
				config: { source: sourceNative, amountInput: '1.1234567' },
				expected: { amount: '1.123456' }
			},
			{
				description: 'truncates the input to the decimals of the source token, not of the native currency',
				config: { source: sourceEthereumNonNative, amountInput: '1.1234567' },
				expected: { amount: '1.123456' }
			},
			{
				description: 'keeps every input decimal the source token supports',
				config: { source: sourceEthereumNative, amountInput: '1.1234567' },
				expected: { amount: '1.1234567' }
			},
			{
				description: 'keeps the raw input while no source is selected',
				config: { source: null, amountInput: '1.1234567' },
				expected: { amount: '1.1234567' }
			}
		];

		amountTests.forEach(test => {
			runAmountTest(test.description, test.config, test.expected);
		});
	});

	describe('available balance', () => {
		const runAvailableBalanceTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const params = createHookParams({
					source: config.source,
					stepFees: config.stepFees
				});

				// Act:
				const hookTester = new HookTester(useBridgeAmount, [params]);

				// Assert:
				expect(hookTester.currentResult.availableBalance).toBe(expected.availableBalance);
			});
		};

		const availableBalanceTests = [
			{
				description: 'subtracts the gas of every step paid in the native currency',
				config: {
					source: sourceNative,
					stepFees: [firstStepFees, secondStepFees]
				},
				expected: { availableBalance: '96' }
			},
			{
				description: 'subtracts only the loaded steps while a later step is not fetched yet',
				config: {
					source: sourceNative,
					stepFees: [firstStepFees, secondStepFeesNotLoaded]
				},
				expected: { availableBalance: '98' }
			},
			{
				description: 'ignores a step paid on another chain',
				config: {
					source: sourceNative,
					stepFees: [firstStepFees, secondStepFeesOnEthereum]
				},
				expected: { availableBalance: '98' }
			},
			{
				description: 'is zero while no step is loaded',
				config: {
					source: sourceNative,
					stepFees: [firstStepFeesNotLoaded]
				},
				expected: { availableBalance: '0' }
			},
			{
				description: 'keeps the full balance of a non-native source whatever the gas',
				config: {
					source: sourceNonNative,
					stepFees: [firstStepFees, secondStepFees]
				},
				expected: { availableBalance: '150' }
			}
		];

		availableBalanceTests.forEach(test => {
			runAvailableBalanceTest(test.description, test.config, test.expected);
		});
	});
});
