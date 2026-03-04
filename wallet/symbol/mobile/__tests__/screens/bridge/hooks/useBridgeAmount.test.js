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

const ACCOUNT = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const NATIVE_TOKEN = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setAmount('100')
	.build();

const NON_NATIVE_TOKEN = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setAmount('150')
	.build();

const NETWORK_CURRENCY = {
	id: NATIVE_TOKEN.id,
	mosaicId: NATIVE_TOKEN.id,
	divisibility: NATIVE_TOKEN.divisibility,
	name: NATIVE_TOKEN.name
};

const NETWORK_PROPERTIES = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setNetworkCurrency(NETWORK_CURRENCY)
	.build();

const WALLET_CONTROLLER_WITH_NETWORK = createWalletControllerMock({
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	networkProperties: NETWORK_PROPERTIES,
	currentAccount: ACCOUNT
});

const WALLET_CONTROLLER_WITHOUT_NETWORK_CURRENCY = createWalletControllerMock({
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	networkProperties: { networkCurrency: null },
	currentAccount: ACCOUNT
});

const SOURCE_NATIVE = {
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	token: NATIVE_TOKEN,
	walletController: WALLET_CONTROLLER_WITH_NETWORK
};

const SOURCE_NON_NATIVE = {
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	token: NON_NATIVE_TOKEN,
	walletController: WALLET_CONTROLLER_WITH_NETWORK
};

const SOURCE_WITHOUT_NETWORK_CURRENCY = {
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	token: NATIVE_TOKEN,
	walletController: WALLET_CONTROLLER_WITHOUT_NETWORK_CURRENCY
};

const TRANSACTION_FEES = [
	{
		[FEE_TIER_LEVEL_AVERAGE]: {
			token: {
				amount: '1',
				divisibility: NATIVE_TOKEN.divisibility
			}
		}
	}
];

// Hook Helpers

const createHookParams = overrides => ({
	source: SOURCE_NATIVE,
	transactionFees: TRANSACTION_FEES,
	transactionFeeTierLevel: FEE_TIER_LEVEL_AVERAGE,
	...overrides
});

describe('hooks/useBridgeAmount', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	runHookContractTest(useBridgeAmount, {
		props: createHookParams(),
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
					source: SOURCE_NATIVE
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
					source: SOURCE_WITHOUT_NETWORK_CURRENCY
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
					source: SOURCE_NON_NATIVE
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
