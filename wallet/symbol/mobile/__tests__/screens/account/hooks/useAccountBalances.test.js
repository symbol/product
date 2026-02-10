import { useAccountBalances } from '@/app/screens/account/hooks/useAccountBalances';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AccountInfoFixtureBuilder } from '__fixtures__/local/AccountInfoFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { renderHook, waitFor } from '@testing-library/react-native';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';

const BalanceValue = {
	ZERO: '0',
	ACCOUNT_1: '1500',
	ACCOUNT_2: '750',
	ACCOUNT_3: '300',
	ACCOUNT_1_CACHED: '1000'
};

// Account Fixtures

const account1 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const account2 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.build();

const account3 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 2)
	.build();

// Network Properties Fixtures

const networkProperties = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME, NETWORK_IDENTIFIER)
	.build();

// Account Info Fixtures

const createCachedAccountInfo = (account, balance) => {
	const builder = AccountInfoFixtureBuilder
		.createEmpty(CHAIN_NAME, NETWORK_IDENTIFIER)
		.override({ address: account.address, publicKey: account.publicKey })
		.setBalance(balance)
		.setFetchedAt(Date.now() - 60000);

	return builder.data;
};

// Network API Mock

const createNetworkApiMock = (balanceMap = {}) => ({
	account: {
		fetchAccountBalance: jest.fn().mockImplementation((networkProperties, address) => {
			const balance = balanceMap[address];

			if (balance === 'error')
				return Promise.reject(new Error('Fetch failed'));

			return Promise.resolve(balance ?? BalanceValue.ZERO);
		})
	}
});

// Wallet Controller Mock

const createWalletControllerMock = (overrides = {}) => ({
	accounts: {
		[NETWORK_IDENTIFIER]: [account1, account2]
	},
	accountInfos: {
		[NETWORK_IDENTIFIER]: {}
	},
	networkIdentifier: NETWORK_IDENTIFIER,
	networkProperties,
	networkApi: createNetworkApiMock(),
	...overrides
});

describe('hooks/useAccountBalances', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('initialization', () => {
		it('returns accountBalances object', () => {
			// Arrange:
			const walletController = createWalletControllerMock();

			// Act:
			const { result } = renderHook(() => useAccountBalances(walletController));

			// Assert:
			expect(result.current.accountBalances).toBeDefined();
			expect(typeof result.current.accountBalances).toBe('object');
		});

		it('initializes with loading state for all accounts', () => {
			// Arrange:
			const walletController = createWalletControllerMock();

			// Act:
			const { result } = renderHook(() => useAccountBalances(walletController));

			// Assert:
			expect(result.current.accountBalances[account1.publicKey].isLoading).toBe(true);
			expect(result.current.accountBalances[account2.publicKey].isLoading).toBe(true);
		});

		it('initializes with zero balance when no cached data exists', () => {
			// Arrange:
			const walletController = createWalletControllerMock();

			// Act:
			const { result } = renderHook(() => useAccountBalances(walletController));

			// Assert:
			expect(result.current.accountBalances[account1.publicKey].balance).toBe(BalanceValue.ZERO);
			expect(result.current.accountBalances[account1.publicKey].balanceChange).toBe(BalanceValue.ZERO);
		});
	});

	describe('balance fetching', () => {
		it('fetches balances for all accounts on mount', async () => {
			// Arrange:
			const balanceMap = {
				[account1.address]: BalanceValue.ACCOUNT_1,
				[account2.address]: BalanceValue.ACCOUNT_2
			};
			const expectedNumberOfCalls = 2;
			const networkApi = createNetworkApiMock(balanceMap);
			const walletController = createWalletControllerMock({ networkApi });

			// Act:
			renderHook(() => useAccountBalances(walletController));

			// Assert:
			await waitFor(() => {
				expect(networkApi.account.fetchAccountBalance).toHaveBeenCalledTimes(expectedNumberOfCalls);
			});
			expect(networkApi.account.fetchAccountBalance).toHaveBeenCalledWith(networkProperties, account1.address);
			expect(networkApi.account.fetchAccountBalance).toHaveBeenCalledWith(networkProperties, account2.address);
		});

		it('updates balances after successful fetch', async () => {
			// Arrange:
			const balanceMap = {
				[account1.address]: BalanceValue.ACCOUNT_1,
				[account2.address]: BalanceValue.ACCOUNT_2
			};
			const networkApi = createNetworkApiMock(balanceMap);
			const walletController = createWalletControllerMock({ networkApi });

			// Act:
			const { result } = renderHook(() => useAccountBalances(walletController));

			// Assert:
			await waitFor(() => {
				expect(result.current.accountBalances[account1.publicKey].balance).toBe(BalanceValue.ACCOUNT_1);
				expect(result.current.accountBalances[account2.publicKey].balance).toBe(BalanceValue.ACCOUNT_2);
			});
		});

		it('sets loading to false after fetch completes', async () => {
			// Arrange:
			const balanceMap = {
				[account1.address]: BalanceValue.ACCOUNT_1,
				[account2.address]: BalanceValue.ACCOUNT_2
			};
			const networkApi = createNetworkApiMock(balanceMap);
			const walletController = createWalletControllerMock({ networkApi });

			// Act:
			const { result } = renderHook(() => useAccountBalances(walletController));

			// Assert:
			await waitFor(() => {
				expect(result.current.accountBalances[account1.publicKey].isLoading).toBe(false);
				expect(result.current.accountBalances[account2.publicKey].isLoading).toBe(false);
			});
		});

		it('sets zero balance when fetch fails', async () => {
			// Arrange:
			const balanceMap = {
				[account1.address]: 'error',
				[account2.address]: BalanceValue.ACCOUNT_2
			};
			const networkApi = createNetworkApiMock(balanceMap);
			const walletController = createWalletControllerMock({ networkApi });

			// Act:
			const { result } = renderHook(() => useAccountBalances(walletController));

			// Assert:
			await waitFor(() => {
				expect(result.current.accountBalances[account2.publicKey].balance).toBe(BalanceValue.ACCOUNT_2);
			});
			expect(result.current.accountBalances[account1.publicKey].balance).toBe(BalanceValue.ZERO);
		});
	});

	describe('cached balances', () => {
		it('displays cached balance when fetch is in progress', () => {
			// Arrange:
			const accountInfos = {
				[NETWORK_IDENTIFIER]: {
					[account1.publicKey]: createCachedAccountInfo(account1, BalanceValue.ACCOUNT_1_CACHED)
				}
			};
			const walletController = createWalletControllerMock({ accountInfos });

			// Act:
			const { result } = renderHook(() => useAccountBalances(walletController));

			// Assert:
			expect(result.current.accountBalances[account1.publicKey].balance).toBe(BalanceValue.ACCOUNT_1_CACHED);
		});

		it('displays fetched balance after fetch completes over cached balance', async () => {
			// Arrange:
			const accountInfos = {
				[NETWORK_IDENTIFIER]: {
					[account1.publicKey]: createCachedAccountInfo(account1, BalanceValue.ACCOUNT_1_CACHED)
				}
			};
			const balanceMap = {
				[account1.address]: BalanceValue.ACCOUNT_1,
				[account2.address]: BalanceValue.ACCOUNT_2
			};
			const networkApi = createNetworkApiMock(balanceMap);
			const walletController = createWalletControllerMock({ accountInfos, networkApi });

			// Act:
			const { result } = renderHook(() => useAccountBalances(walletController));

			// Assert:
			await waitFor(() => {
				expect(result.current.accountBalances[account1.publicKey].balance).toBe(BalanceValue.ACCOUNT_1);
			});
		});
	});

	describe('balance change calculation', () => {
		const runBalanceChangeTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const accountInfos = {
					[NETWORK_IDENTIFIER]: {
						[account1.publicKey]: config.hasCachedInfo
							? createCachedAccountInfo(account1, config.cachedBalance)
							: null
					}
				};
				const balanceMap = {
					[account1.address]: config.fetchedBalance,
					[account2.address]: BalanceValue.ZERO
				};
				const networkApi = createNetworkApiMock(balanceMap);
				const walletController = createWalletControllerMock({ accountInfos, networkApi });

				// Act:
				const { result } = renderHook(() => useAccountBalances(walletController));

				// Assert:
				await waitFor(() => {
					expect(result.current.accountBalances[account1.publicKey].balanceChange).toBe(expected.balanceChange);
				});
			});
		};

		const balanceChangeTests = [
			{
				description: 'calculates positive balance change correctly',
				config: { cachedBalance: '1000', fetchedBalance: '1500', hasCachedInfo: true },
				expected: { balanceChange: '500' }
			},
			{
				description: 'calculates negative balance change correctly',
				config: { cachedBalance: '1000', fetchedBalance: '700', hasCachedInfo: true },
				expected: { balanceChange: '-300' }
			},
			{
				description: 'returns zero when balances are equal',
				config: { cachedBalance: '1000', fetchedBalance: '1000', hasCachedInfo: true },
				expected: { balanceChange: '0' }
			},
			{
				description: 'returns zero when no cached exists',
				config: { cachedBalance: null, fetchedBalance: '1000', hasCachedInfo: false },
				expected: { balanceChange: '0' }
			}
		];

		balanceChangeTests.forEach(test => {
			runBalanceChangeTest(test.description, test.config, test.expected);
		});
	});

	describe('empty accounts', () => {
		it('does not fetch when no accounts exist', () => {
			// Arrange:
			const networkApi = createNetworkApiMock();
			const walletController = createWalletControllerMock({
				accounts: { [NETWORK_IDENTIFIER]: [] },
				networkApi
			});

			// Act:
			const { result } = renderHook(() => useAccountBalances(walletController));

			// Assert:
			expect(networkApi.account.fetchAccountBalance).not.toHaveBeenCalled();
			expect(result.current.accountBalances).toEqual({});
		});
	});

	describe('refetch behaviour', () => {
		const runRefetchTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const balanceMap = {
					[account1.address]: BalanceValue.ACCOUNT_1,
					[account2.address]: BalanceValue.ACCOUNT_2,
					[account3.address]: BalanceValue.ACCOUNT_3
				};
				const networkApi = createNetworkApiMock(balanceMap);
				const createController = accounts => ({
					...createWalletControllerMock({ networkApi }),
					accounts: {
						[NETWORK_IDENTIFIER]: accounts
					}
				});
				const initialController = createController(config.initialAccounts);
				const changedController = createController(config.changedAccounts);

				// Act (first render):
				const { rerender } = renderHook(
					({ controller }) => useAccountBalances(controller),
					{
						initialProps: { controller: initialController }
					}
				);

				await waitFor(() => {
					expect(networkApi.account.fetchAccountBalance)
						.toHaveBeenCalledTimes(config.initialAccounts.length);
				});

				// Act (after accounts change or not change):
				rerender({ controller: changedController });

				// Assert:
				await waitFor(() => {
					expect(networkApi.account.fetchAccountBalance)
						.toHaveBeenCalledTimes(expected.fetchCalls);
				});
			});
		};

		const refetchTests = [
			{
				description: 'fetch on first render',
				config: {
					initialAccounts: [account1, account2],
					changedAccounts: [account1, account2]
				},
				expected: { fetchCalls: 2 }
			},
			{
				description: 'refetch when account added to the list',
				config: {
					initialAccounts: [account1, account2],
					changedAccounts: [account1, account2, account3]
				},
				expected: { fetchCalls: 5 }
			},
			{
				description: 'does not refetch when accounts are reordered',
				config: {
					initialAccounts: [account1, account2],
					changedAccounts: [account2, account1]
				},
				expected: { fetchCalls: 2 }
			}
		];

		refetchTests.forEach(test => {
			runRefetchTest(test.description, test.config, test.expected);
		});
	});
});
