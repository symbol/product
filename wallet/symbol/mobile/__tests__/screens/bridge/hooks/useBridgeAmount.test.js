import { useBridgeAmount } from '@/app/screens/bridge/hooks/useBridgeAmount';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { HookTester } from '__tests__/HookTester';
import { runHookContractTest } from '__tests__/hook-tests';
import { createWalletControllerMock } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const FEE_TIER_LEVEL_AVERAGE = 'average';

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

const transactionFees = [
	{
		[FEE_TIER_LEVEL_AVERAGE]: {
			token: {
				amount: '1',
				divisibility: nativeToken.divisibility
			}
		}
	}
];

// Hook Helpers

const createHookParams = overrides => ({
	source: sourceNative,
	transactionFees,
	transactionFeeTierLevel: FEE_TIER_LEVEL_AVERAGE,
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
					availableBalance: '99'
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
});
