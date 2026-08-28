import { useAccountMultisigStates } from '@/app/screens/account/hooks/useAccountMultisigStates';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AccountInfoFixtureBuilder } from '__fixtures__/local/AccountInfoFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { HookTester } from '__tests__/HookTester';
import { runHookContractTest } from '__tests__/hook-tests';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';

// Account Fixtures

const testedAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const otherAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.build();

const addedAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 2)
	.build();

// Network Properties Fixtures

const networkProperties = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME, NETWORK_IDENTIFIER)
	.build();

// Multisig Info Responses

const MultisigInfoResponse = {
	MULTISIG: { cosignatories: [otherAccount.address] },
	REGULAR: { cosignatories: [] },
	ERROR: 'error'
};

// Account Info Fixtures

const createCachedAccountInfo = (account, isMultisig) => AccountInfoFixtureBuilder
	.createEmpty(CHAIN_NAME, NETWORK_IDENTIFIER)
	.override({ address: account.address, publicKey: account.publicKey })
	.setMultisigStatusByIndexes(isMultisig, [1])
	.build();

const testedAccountInfoMultisig = createCachedAccountInfo(testedAccount, true);
const testedAccountInfoRegular = createCachedAccountInfo(testedAccount, false);

const createAccountInfos = cachedAccountInfo => ({
	[NETWORK_IDENTIFIER]: cachedAccountInfo
		? { [testedAccount.publicKey]: cachedAccountInfo }
		: {}
});

// Network API Mock

const createNetworkApiMock = (multisigInfoMap = {}) => ({
	account: {
		fetchMultisigInfo: jest.fn().mockImplementation((networkProperties, address) => {
			const multisigInfo = multisigInfoMap[address];

			if (multisigInfo === MultisigInfoResponse.ERROR)
				return Promise.reject(new Error('Fetch failed'));

			return Promise.resolve(multisigInfo ?? MultisigInfoResponse.REGULAR);
		})
	}
});

const createPendingNetworkApiMock = () => ({
	account: {
		fetchMultisigInfo: jest.fn().mockImplementation(() => new Promise(() => {}))
	}
});

// Wallet Controller Mock

const createWalletControllerMock = (overrides = {}) => ({
	accounts: {
		[NETWORK_IDENTIFIER]: [testedAccount, otherAccount]
	},
	accountInfos: createAccountInfos(null),
	networkIdentifier: NETWORK_IDENTIFIER,
	networkProperties,
	networkApi: createNetworkApiMock(),
	...overrides
});

describe('hooks/useAccountMultisigStates', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	runHookContractTest(useAccountMultisigStates, {
		props: [createWalletControllerMock({ networkApi: createPendingNetworkApiMock() })],
		contract: {
			accountMultisigStates: 'object'
		}
	});

	describe('initial state', () => {
		const runInitialStateTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const walletController = createWalletControllerMock({
					accountInfos: createAccountInfos(config.cachedAccountInfo),
					networkApi: createPendingNetworkApiMock()
				});

				// Act:
				const hookTester = new HookTester(useAccountMultisigStates, [walletController]);

				// Assert:
				expect(hookTester.currentResult.accountMultisigStates[testedAccount.publicKey]).toBe(expected.isMultisig);
			});
		};

		const initialStateTests = [
			{
				description: 'seeds true from cached multisig account info',
				config: { cachedAccountInfo: testedAccountInfoMultisig },
				expected: { isMultisig: true }
			},
			{
				description: 'seeds false from cached regular account info',
				config: { cachedAccountInfo: testedAccountInfoRegular },
				expected: { isMultisig: false }
			},
			{
				description: 'defaults to false when no cached account info exists',
				config: { cachedAccountInfo: null },
				expected: { isMultisig: false }
			}
		];

		initialStateTests.forEach(test => {
			runInitialStateTest(test.description, test.config, test.expected);
		});
	});

	describe('fetched state', () => {
		const runFetchedStateTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const networkApi = createNetworkApiMock({
					[testedAccount.address]: config.multisigInfoResponse,
					[otherAccount.address]: MultisigInfoResponse.MULTISIG
				});
				const walletController = createWalletControllerMock({
					accountInfos: createAccountInfos(config.cachedAccountInfo),
					networkApi
				});

				// Act:
				const hookTester = new HookTester(useAccountMultisigStates, [walletController]);

				// Assert:
				// The other account flips to true only once the whole fetch sweep has settled
				await hookTester.waitFor(() => {
					expect(hookTester.currentResult.accountMultisigStates[otherAccount.publicKey]).toBe(true);
				});
				expect(hookTester.currentResult.accountMultisigStates[testedAccount.publicKey]).toBe(expected.isMultisig);
			});
		};

		const fetchedStateTests = [
			{
				description: 'overrides cached false with fetched multisig info',
				config: {
					cachedAccountInfo: testedAccountInfoRegular,
					multisigInfoResponse: MultisigInfoResponse.MULTISIG
				},
				expected: { isMultisig: true }
			},
			{
				description: 'overrides cached true with fetched regular info',
				config: {
					cachedAccountInfo: testedAccountInfoMultisig,
					multisigInfoResponse: MultisigInfoResponse.REGULAR
				},
				expected: { isMultisig: false }
			},
			{
				description: 'sets true from fetched multisig info when no cached account info exists',
				config: {
					cachedAccountInfo: null,
					multisigInfoResponse: MultisigInfoResponse.MULTISIG
				},
				expected: { isMultisig: true }
			},
			{
				description: 'keeps cached true when fetch fails',
				config: {
					cachedAccountInfo: testedAccountInfoMultisig,
					multisigInfoResponse: MultisigInfoResponse.ERROR
				},
				expected: { isMultisig: true }
			},
			{
				description: 'keeps false when fetch fails and no cached account info exists',
				config: {
					cachedAccountInfo: null,
					multisigInfoResponse: MultisigInfoResponse.ERROR
				},
				expected: { isMultisig: false }
			}
		];

		fetchedStateTests.forEach(test => {
			runFetchedStateTest(test.description, test.config, test.expected);
		});
	});

	describe('fetch requests', () => {
		it('fetches multisig info for each account on mount', async () => {
			// Arrange:
			const expectedNumberOfCalls = 2;
			const networkApi = createNetworkApiMock({
				[testedAccount.address]: MultisigInfoResponse.MULTISIG,
				[otherAccount.address]: MultisigInfoResponse.MULTISIG
			});
			const walletController = createWalletControllerMock({ networkApi });

			// Act:
			const hookTester = new HookTester(useAccountMultisigStates, [walletController]);

			// Assert:
			await hookTester.waitFor(() => {
				expect(hookTester.currentResult.accountMultisigStates[testedAccount.publicKey]).toBe(true);
				expect(hookTester.currentResult.accountMultisigStates[otherAccount.publicKey]).toBe(true);
			});
			expect(networkApi.account.fetchMultisigInfo).toHaveBeenCalledTimes(expectedNumberOfCalls);
			expect(networkApi.account.fetchMultisigInfo).toHaveBeenCalledWith(networkProperties, testedAccount.address);
			expect(networkApi.account.fetchMultisigInfo).toHaveBeenCalledWith(networkProperties, otherAccount.address);
		});

		it('does not fetch when no accounts exist', () => {
			// Arrange:
			const networkApi = createNetworkApiMock();
			const walletController = createWalletControllerMock({
				accounts: { [NETWORK_IDENTIFIER]: [] },
				networkApi
			});

			// Act:
			const hookTester = new HookTester(useAccountMultisigStates, [walletController]);

			// Assert:
			expect(networkApi.account.fetchMultisigInfo).not.toHaveBeenCalled();
			expect(hookTester.currentResult.accountMultisigStates).toEqual({});
		});
	});

	describe('refetch behaviour', () => {
		const runRefetchTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const networkApi = createNetworkApiMock({
					[testedAccount.address]: MultisigInfoResponse.MULTISIG,
					[otherAccount.address]: MultisigInfoResponse.MULTISIG,
					[addedAccount.address]: MultisigInfoResponse.MULTISIG
				});
				const createController = accounts => createWalletControllerMock({
					accounts: { [NETWORK_IDENTIFIER]: accounts },
					networkApi
				});
				const initialController = createController(config.initialAccounts);
				const changedController = createController(config.changedAccounts);
				const expectAllAccountsFetched = accounts => {
					accounts.forEach(account => {
						expect(hookTester.currentResult.accountMultisigStates[account.publicKey]).toBe(true);
					});
				};

				// Act (first render):
				const hookTester = new HookTester(useAccountMultisigStates, [initialController]);
				await hookTester.waitFor(() => expectAllAccountsFetched(config.initialAccounts));

				// Act (after accounts change or not change):
				hookTester.updateProps([changedController]);
				await hookTester.waitFor(() => expectAllAccountsFetched(config.changedAccounts));

				// Assert:
				expect(networkApi.account.fetchMultisigInfo).toHaveBeenCalledTimes(expected.fetchCalls);
			});
		};

		const refetchTests = [
			{
				description: 'fetches once when accounts do not change',
				config: {
					initialAccounts: [testedAccount, otherAccount],
					changedAccounts: [testedAccount, otherAccount]
				},
				expected: { fetchCalls: 2 }
			},
			{
				description: 'refetches when account is added to the list',
				config: {
					initialAccounts: [testedAccount, otherAccount],
					changedAccounts: [testedAccount, otherAccount, addedAccount]
				},
				expected: { fetchCalls: 5 }
			},
			{
				description: 'does not refetch when accounts are reordered',
				config: {
					initialAccounts: [testedAccount, otherAccount],
					changedAccounts: [otherAccount, testedAccount]
				},
				expected: { fetchCalls: 2 }
			}
		];

		refetchTests.forEach(test => {
			runRefetchTest(test.description, test.config, test.expected);
		});
	});
});
