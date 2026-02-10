import { useSeedAccountBalances } from '@/app/screens/account/hooks/useSeedAccountBalances';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { renderHook, waitFor } from '@testing-library/react-native';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';

// Account Fixtures
const SEED_ACCOUNT_1 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const SEED_ACCOUNT_2 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.build();

const SEED_ACCOUNT_3 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 2)
	.build();

const SEED_ACCOUNTS_ONE = [SEED_ACCOUNT_1];
const SEED_ACCOUNTS_TWO = [SEED_ACCOUNT_1, SEED_ACCOUNT_2];
const SEED_ACCOUNTS_THREE = [SEED_ACCOUNT_1, SEED_ACCOUNT_2, SEED_ACCOUNT_3];

// Network Properties Fixtures
const NETWORK_PROPERTIES = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME, NETWORK_IDENTIFIER)
	.build();

// Balance values
const BALANCE_VALUES = {
	ACCOUNT_1: '1500',
	ACCOUNT_2: '750',
	ACCOUNT_3: '2000',
	ZERO: '0'
};

// Mock Configurations

const createNetworkApiMock = (balanceMap = {}) => ({
	account: {
		fetchAccountBalance: jest.fn().mockImplementation((networkProperties, address) => {
			const balance = balanceMap[address];
			if (balance === undefined)
				return Promise.resolve('0');

			if (balance === 'error')
				return Promise.reject(new Error('Fetch failed'));

			return Promise.resolve(balance);
		})
	}
});

const createDefaultBalanceMap = () => ({
	[SEED_ACCOUNT_1.address]: BALANCE_VALUES.ACCOUNT_1,
	[SEED_ACCOUNT_2.address]: BALANCE_VALUES.ACCOUNT_2,
	[SEED_ACCOUNT_3.address]: BALANCE_VALUES.ACCOUNT_3
});

describe('hooks/useSeedAccountBalances', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('initialization', () => {
		it('returns accountBalances', () => {
			// Arrange:
			const networkApi = createNetworkApiMock(createDefaultBalanceMap());

			// Act:
			const { result } = renderHook(() => useSeedAccountBalances({
				seedAccounts: SEED_ACCOUNTS_TWO,
				networkProperties: NETWORK_PROPERTIES,
				networkApi
			}));

			// Assert:
			expect(result.current.accountBalances).toBeDefined();
		});

		it('initializes with loading state for all accounts', () => {
			// Arrange:
			const networkApi = createNetworkApiMock(createDefaultBalanceMap());

			// Act:
			const { result } = renderHook(() => useSeedAccountBalances({
				seedAccounts: SEED_ACCOUNTS_TWO,
				networkProperties: NETWORK_PROPERTIES,
				networkApi
			}));

			// Assert:
			expect(result.current.accountBalances[SEED_ACCOUNT_1.publicKey].isLoading).toBe(true);
			expect(result.current.accountBalances[SEED_ACCOUNT_2.publicKey].isLoading).toBe(true);
		});

		it('initializes with zero balance before fetch completes', () => {
			// Arrange:
			const networkApi = createNetworkApiMock(createDefaultBalanceMap());

			// Act:
			const { result } = renderHook(() => useSeedAccountBalances({
				seedAccounts: SEED_ACCOUNTS_TWO,
				networkProperties: NETWORK_PROPERTIES,
				networkApi
			}));

			// Assert:
			expect(result.current.accountBalances[SEED_ACCOUNT_1.publicKey].balance).toBe('0');
			expect(result.current.accountBalances[SEED_ACCOUNT_2.publicKey].balance).toBe('0');
		});
	});

	describe('balance fetching', () => {
		it('fetches balances for all seed accounts on mount', async () => {
			// Arrange:
			const networkApi = createNetworkApiMock(createDefaultBalanceMap());

			// Act:
			renderHook(() => useSeedAccountBalances({
				seedAccounts: SEED_ACCOUNTS_TWO,
				networkProperties: NETWORK_PROPERTIES,
				networkApi
			}));

			// Assert:
			await waitFor(() => {
				expect(networkApi.account.fetchAccountBalance).toHaveBeenCalledTimes(2);
			});
			expect(networkApi.account.fetchAccountBalance).toHaveBeenCalledWith(
				NETWORK_PROPERTIES,
				SEED_ACCOUNT_1.address
			);
			expect(networkApi.account.fetchAccountBalance).toHaveBeenCalledWith(
				NETWORK_PROPERTIES,
				SEED_ACCOUNT_2.address
			);
		});

		it('updates balances after successful fetch', async () => {
			// Arrange:
			const networkApi = createNetworkApiMock(createDefaultBalanceMap());

			// Act:
			const { result } = renderHook(() => useSeedAccountBalances({
				seedAccounts: SEED_ACCOUNTS_TWO,
				networkProperties: NETWORK_PROPERTIES,
				networkApi
			}));

			// Assert:
			await waitFor(() => {
				expect(result.current.accountBalances[SEED_ACCOUNT_1.publicKey].balance).toBe(BALANCE_VALUES.ACCOUNT_1);
			});
			expect(result.current.accountBalances[SEED_ACCOUNT_2.publicKey].balance).toBe(BALANCE_VALUES.ACCOUNT_2);
		});

		it('sets loading to false after fetch completes', async () => {
			// Arrange:
			const networkApi = createNetworkApiMock(createDefaultBalanceMap());

			// Act:
			const { result } = renderHook(() => useSeedAccountBalances({
				seedAccounts: SEED_ACCOUNTS_TWO,
				networkProperties: NETWORK_PROPERTIES,
				networkApi
			}));

			// Assert:
			await waitFor(() => {
				expect(result.current.accountBalances[SEED_ACCOUNT_1.publicKey].isLoading).toBe(false);
			});
			expect(result.current.accountBalances[SEED_ACCOUNT_2.publicKey].isLoading).toBe(false);
		});

		it('handles fetch errors gracefully', async () => {
			// Arrange:
			const balanceMap = {
				[SEED_ACCOUNT_1.address]: 'error',
				[SEED_ACCOUNT_2.address]: BALANCE_VALUES.ACCOUNT_2
			};
			const networkApi = createNetworkApiMock(balanceMap);

			// Act:
			const { result } = renderHook(() => useSeedAccountBalances({
				seedAccounts: SEED_ACCOUNTS_TWO,
				networkProperties: NETWORK_PROPERTIES,
				networkApi
			}));

			// Assert:
			await waitFor(() => {
				expect(result.current.accountBalances[SEED_ACCOUNT_2.publicKey].balance).toBe(BALANCE_VALUES.ACCOUNT_2);
			});
			expect(result.current.accountBalances[SEED_ACCOUNT_1.publicKey].balance).toBe('0');
			expect(result.current.accountBalances[SEED_ACCOUNT_1.publicKey].isLoading).toBe(false);
		});
	});

	describe('empty seedAccounts array', () => {
		it('does not fetch when seedAccounts is empty array', async () => {
			// Arrange:
			const networkApi = createNetworkApiMock(createDefaultBalanceMap());
			const seedAccounts = [];
			const expected = { fetchCallCount: 0, accountBalances: {} };

			// Act:
			const { result } = renderHook(() => useSeedAccountBalances({
				seedAccounts,
				networkProperties: NETWORK_PROPERTIES,
				networkApi
			}));

			// Assert:
			expect(networkApi.account.fetchAccountBalance).toHaveBeenCalledTimes(expected.fetchCallCount);
			expect(result.current.accountBalances).toEqual(expected.accountBalances);
		});
	});

	describe('multiple accounts', () => {
		const runMultipleAccountsTest = async (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const networkApi = createNetworkApiMock(config.balanceMap);

				// Act:
				const { result } = renderHook(() => useSeedAccountBalances({
					seedAccounts: config.seedAccounts,
					networkProperties: NETWORK_PROPERTIES,
					networkApi
				}));

				// Assert:
				await waitFor(() => {
					expect(result.current.accountBalances[config.seedAccounts[0].publicKey].balance)
						.toBe(expected.balances[config.seedAccounts[0].publicKey]);
				});
				config.seedAccounts.forEach(account => {
					expect(result.current.accountBalances[account.publicKey].balance).toBe(expected.balances[account.publicKey]);
				});
				expect(networkApi.account.fetchAccountBalance).toHaveBeenCalledTimes(expected.callCount);
			});
		};

		const tests = [
			{
				description: 'handles single account correctly',
				config: {
					seedAccounts: SEED_ACCOUNTS_ONE,
					balanceMap: createDefaultBalanceMap()
				},
				expected: {
					balances: { [SEED_ACCOUNT_1.publicKey]: BALANCE_VALUES.ACCOUNT_1 },
					callCount: 1
				}
			},
			{
				description: 'handles two accounts correctly',
				config: {
					seedAccounts: SEED_ACCOUNTS_TWO,
					balanceMap: createDefaultBalanceMap()
				},
				expected: {
					balances: {
						[SEED_ACCOUNT_1.publicKey]: BALANCE_VALUES.ACCOUNT_1,
						[SEED_ACCOUNT_2.publicKey]: BALANCE_VALUES.ACCOUNT_2
					},
					callCount: 2
				}
			},
			{
				description: 'handles three accounts correctly',
				config: {
					seedAccounts: SEED_ACCOUNTS_THREE,
					balanceMap: createDefaultBalanceMap()
				},
				expected: {
					balances: {
						[SEED_ACCOUNT_1.publicKey]: BALANCE_VALUES.ACCOUNT_1,
						[SEED_ACCOUNT_2.publicKey]: BALANCE_VALUES.ACCOUNT_2,
						[SEED_ACCOUNT_3.publicKey]: BALANCE_VALUES.ACCOUNT_3
					},
					callCount: 3
				}
			}
		];

		tests.forEach(test => {
			runMultipleAccountsTest(test.description, test.config, test.expected);
		});
	});

	describe('seed accounts change', () => {
		it('refetches when seed accounts array changes', async () => {
			// Arrange:
			const balanceMap = createDefaultBalanceMap();
			const networkApi = createNetworkApiMock(balanceMap);

			let seedAccounts = [SEED_ACCOUNT_1];
			const { rerender } = renderHook(() => useSeedAccountBalances({
				seedAccounts,
				networkProperties: NETWORK_PROPERTIES,
				networkApi
			}));

			await waitFor(() => {
				expect(networkApi.account.fetchAccountBalance).toHaveBeenCalledTimes(1);
			});

			// Act:
			seedAccounts = [SEED_ACCOUNT_1, SEED_ACCOUNT_2];
			rerender();

			// Assert:
			await waitFor(() => {
				expect(networkApi.account.fetchAccountBalance).toHaveBeenCalledTimes(3);
			});
		});
	});
});
