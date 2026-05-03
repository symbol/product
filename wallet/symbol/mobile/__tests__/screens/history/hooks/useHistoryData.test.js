import { SymbolTransactionType, TransactionGroup } from '@/app/constants';
import * as hooks from '@/app/hooks';
import { useHistoryData } from '@/app/screens/history/hooks/useHistoryData';
import { useReceiptHistory } from '@/app/screens/history/hooks/useReceiptHistory';
import { useTransactionHistory } from '@/app/screens/history/hooks/useTransactionHistory';
import { SectionType } from '@/app/screens/history/utils';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AggregateTransactionFixtureBuilder } from '__fixtures__/local/AggregateTransactionFixtureBuilde';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { ReceiptFixtureBuilder } from '__fixtures__/local/ReceiptFixtureBuilder';
import { TransferTransactionFixtureBuilder } from '__fixtures__/local/TransferTransactionFixtureBuilder';
import { mockLocalization, mockWalletController } from '__tests__/mock-helpers';
import { act, renderHook } from '@testing-library/react-native';

jest.mock('@/app/screens/history/hooks/useTransactionHistory', () => ({
	useTransactionHistory: jest.fn()
}));

jest.mock('@/app/screens/history/hooks/useReceiptHistory', () => ({
	useReceiptHistory: jest.fn()
}));

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const TICKER = 'XYM';

const FIRST_PAGE = 1;

// Screen Text

const SCREEN_TEXT = {
	textSectionPartial: 'transactionGroup_partial',
	textSectionUnconfirmed: 'transactionGroup_unconfirmed',
	textSectionConfirmed: 'transactionGroup_confirmed',
	textSectionHarvested: 'transactionGroup_harvested',
	textFilterType: 's_history_filter_type',
	textFilterFrom: 's_history_filter_from',
	textFilterTo: 's_history_filter_to',
	textFilterHarvested: 's_history_filter_harvested',
	textFilterBlocked: 's_history_filter_blocked'
};

const FilterName = {
	TYPE: 'type',
	FROM: 'from',
	TO: 'to',
	HARVESTED: 'harvested',
	BLOCKED: 'blocked'
};

const LoadingState = {
	IDLE: [false, false],
	INITIAL_LOADING: [true, false],
	REFRESHING: [false, true]
};

// Fixtures

const currentAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const otherAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.build();

const networkProperties = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME, NETWORK_IDENTIFIER)
	.build();

const confirmedTransfer1 = TransferTransactionFixtureBuilder
	.createDefault(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setHash('HASH_CONFIRMED_1')
	.setHeight(100000)
	.setAmount('-100')
	.build();

const confirmedTransfer2 = TransferTransactionFixtureBuilder
	.createDefault(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setHash('HASH_CONFIRMED_2')
	.setHeight(100001)
	.setAmount('200')
	.build();

const unconfirmedTransfer = TransferTransactionFixtureBuilder
	.createDefault(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setHash('HASH_UNCONFIRMED_1')
	.setHeight(0)
	.setAmount('-25')
	.build();

const partialAggregate = AggregateTransactionFixtureBuilder
	.createDefaultBonded(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setHash('HASH_PARTIAL_1')
	.setAmount('0')
	.build();

const harvestingReceipt1 = ReceiptFixtureBuilder
	.createHarvestingReward('10', 200000)
	.build();

const harvestingReceipt2 = ReceiptFixtureBuilder
	.createHarvestingReward('20', 200001)
	.build();

const CONFIRMED_TRANSACTIONS = [confirmedTransfer1, confirmedTransfer2];
const UNCONFIRMED_TRANSACTIONS = [unconfirmedTransfer];
const PARTIAL_TRANSACTIONS = [partialAggregate];
const HARVESTING_RECEIPTS = [harvestingReceipt1, harvestingReceipt2];

// Mock Creators

const createTransactionHistoryMock = (overrides = {}) => ({
	confirmed: [],
	unconfirmed: [],
	partial: [],
	isLoading: false,
	isPageLoading: false,
	isLastPage: false,
	refresh: jest.fn().mockResolvedValue(),
	resetAndRefresh: jest.fn().mockResolvedValue(),
	fetchNextPage: jest.fn().mockResolvedValue(),
	...overrides
});

const createReceiptHistoryMock = (overrides = {}) => ({
	receipts: [],
	isLoading: false,
	isPageLoading: false,
	isLastPage: false,
	refresh: jest.fn().mockResolvedValue(),
	resetAndRefresh: jest.fn().mockResolvedValue(),
	fetchNextPage: jest.fn().mockResolvedValue(),
	...overrides
});

const mockWalletControllerConfigured = (overrides = {}) => {
	return mockWalletController({
		chainName: CHAIN_NAME,
		ticker: TICKER,
		networkIdentifier: NETWORK_IDENTIFIER,
		networkProperties,
		accounts: {
			mainnet: [],
			testnet: [currentAccount, otherAccount]
		},
		currentAccount,
		isWalletReady: true,
		...overrides
	});
};

// Predefined History Configurations

const HISTORY_CONFIG_EMPTY = {
	transactionHistory: createTransactionHistoryMock(),
	receiptHistory: createReceiptHistoryMock()
};

const HISTORY_CONFIG_TRANSACTIONS = {
	transactionHistory: createTransactionHistoryMock({
		confirmed: CONFIRMED_TRANSACTIONS,
		unconfirmed: UNCONFIRMED_TRANSACTIONS,
		partial: PARTIAL_TRANSACTIONS
	}),
	receiptHistory: createReceiptHistoryMock()
};

const HISTORY_CONFIG_RECEIPTS = {
	transactionHistory: createTransactionHistoryMock(),
	receiptHistory: createReceiptHistoryMock({
		receipts: HARVESTING_RECEIPTS
	})
};

const mockHistoryHooks = (config = HISTORY_CONFIG_EMPTY) => {
	useTransactionHistory.mockReturnValue(config.transactionHistory);
	useReceiptHistory.mockReturnValue(config.receiptHistory);
};

describe('hooks/useHistoryData', () => {
	beforeEach(() => {
		mockLocalization();
		jest.clearAllMocks();
		jest.spyOn(hooks, 'useInit').mockImplementation(() => {});
		jest.spyOn(hooks, 'useLoading').mockReturnValue(LoadingState.IDLE);
		jest.spyOn(hooks, 'useTransactionListener').mockImplementation(() => {});
		mockHistoryHooks();
	});

	describe('filter', () => {
		it('initializes with empty filter', () => {
			// Arrange:
			const walletController = mockWalletControllerConfigured();

			// Act:
			const { result } = renderHook(() => useHistoryData({ walletController }));

			// Assert:
			expect(result.current.filter).toEqual({});
		});

		it('returns expected filter config names', () => {
			// Arrange:
			const walletController = mockWalletControllerConfigured();
			const expectedFilterNames = [
				FilterName.TYPE,
				FilterName.FROM,
				FilterName.TO,
				FilterName.HARVESTED,
				FilterName.BLOCKED
			];

			// Act:
			const { result } = renderHook(() => useHistoryData({ walletController }));
			const receivedFilterNames = result.current.filterConfig.map(filterConfig => filterConfig.name);

			// Assert:
			expect(receivedFilterNames).toEqual(expectedFilterNames);
		});

		it('returns expected filter config translation keys', () => {
			// Arrange:
			const walletController = mockWalletControllerConfigured();
			const expectedFilterTitles = [
				SCREEN_TEXT.textFilterType,
				SCREEN_TEXT.textFilterFrom,
				SCREEN_TEXT.textFilterTo,
				SCREEN_TEXT.textFilterHarvested,
				SCREEN_TEXT.textFilterBlocked
			];

			// Act:
			const { result } = renderHook(() => useHistoryData({ walletController }));
			const receivedFilterTitles = result.current.filterConfig.map(filterConfig => filterConfig.title);

			// Assert:
			expect(receivedFilterTitles).toEqual(expectedFilterTitles);
		});

		it('updates filter with setFilter', () => {
			// Arrange:
			const walletController = mockWalletControllerConfigured();
			const selectedFilter = { type: [SymbolTransactionType.TRANSFER] };
			const { result } = renderHook(() => useHistoryData({ walletController }));

			// Act:
			act(() => {
				result.current.setFilter(selectedFilter);
			});

			// Assert:
			expect(result.current.filter).toEqual(selectedFilter);
		});
	});

	describe('sections', () => {
		const runSectionTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				mockHistoryHooks(config.historyConfig);
				const walletController = mockWalletControllerConfigured();

				// Act:
				const { result } = renderHook(() => useHistoryData({ walletController }));
				if (config.filter)
					act(() => result.current.setFilter(config.filter));

				const sectionGroups = result.current.sections.map(section => section.group);
				const sectionTitles = result.current.sections.map(section => section.title);

				// Assert:
				expect(result.current.sections).toHaveLength(expected.sectionCount);
				if (expected.sectionGroups)
					expect(sectionGroups).toEqual(expected.sectionGroups);
				if (expected.sectionTitles)
					expect(sectionTitles).toEqual(expected.sectionTitles);
			});
		};

		const sectionTests = [
			{
				description: 'returns no sections when all histories are empty',
				config: {
					historyConfig: HISTORY_CONFIG_EMPTY
				},
				expected: {
					sectionCount: 0
				}
			},
			{
				description: 'returns transaction sections in expected order in normal mode',
				config: {
					historyConfig: HISTORY_CONFIG_TRANSACTIONS
				},
				expected: {
					sectionCount: 3,
					sectionGroups: [TransactionGroup.PARTIAL, TransactionGroup.UNCONFIRMED, TransactionGroup.CONFIRMED],
					sectionTitles: [
						SCREEN_TEXT.textSectionPartial,
						SCREEN_TEXT.textSectionUnconfirmed,
						SCREEN_TEXT.textSectionConfirmed
					]
				}
			},
			{
				description: 'returns only receipts section in harvested mode',
				config: {
					historyConfig: HISTORY_CONFIG_RECEIPTS,
					filter: { harvested: true }
				},
				expected: {
					sectionCount: 1,
					sectionGroups: [SectionType.RECEIPTS],
					sectionTitles: [SCREEN_TEXT.textSectionHarvested]
				}
			}
		];

		sectionTests.forEach(test => {
			runSectionTest(test.description, test.config, test.expected);
		});
	});

	describe('loading states', () => {
		const runLoadingTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				hooks.useLoading.mockReturnValue(config.loadingState);
				mockHistoryHooks(config.historyConfig ?? HISTORY_CONFIG_EMPTY);
				const walletController = mockWalletControllerConfigured();

				// Act:
				const { result } = renderHook(() => useHistoryData({ walletController }));
				if (config.filter)
					act(() => result.current.setFilter(config.filter));

				// Assert:
				expect(result.current.isLoading).toBe(expected.isLoading);
				expect(result.current.isRefreshing).toBe(expected.isRefreshing);
				expect(result.current.isPageLoading).toBe(expected.isPageLoading);
			});
		};

		const loadingTests = [
			{
				description: 'returns idle loading values',
				config: {
					loadingState: LoadingState.IDLE,
					historyConfig: HISTORY_CONFIG_EMPTY
				},
				expected: {
					isLoading: false,
					isRefreshing: false,
					isPageLoading: false
				}
			},
			{
				description: 'returns initial loading values',
				config: {
					loadingState: LoadingState.INITIAL_LOADING,
					historyConfig: HISTORY_CONFIG_EMPTY
				},
				expected: {
					isLoading: true,
					isRefreshing: false,
					isPageLoading: false
				}
			},
			{
				description: 'returns refreshing values',
				config: {
					loadingState: LoadingState.REFRESHING,
					historyConfig: HISTORY_CONFIG_EMPTY
				},
				expected: {
					isLoading: false,
					isRefreshing: true,
					isPageLoading: false
				}
			},
			{
				description: 'returns page loading from selected transaction history',
				config: {
					loadingState: LoadingState.IDLE,
					historyConfig: {
						...HISTORY_CONFIG_TRANSACTIONS,
						transactionHistory: createTransactionHistoryMock({
							confirmed: CONFIRMED_TRANSACTIONS,
							isPageLoading: true
						})
					}
				},
				expected: {
					isLoading: false,
					isRefreshing: false,
					isPageLoading: true
				}
			}
		];

		loadingTests.forEach(test => {
			runLoadingTest(test.description, test.config, test.expected);
		});
	});

	describe('footer visibility', () => {
		const runShouldShowFooterTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				mockHistoryHooks(config.historyConfig);
				const walletController = mockWalletControllerConfigured();

				// Act:
				const { result } = renderHook(() => useHistoryData({ walletController }));
				if (config.filter)
					act(() => result.current.setFilter(config.filter));

				// Assert:
				expect(result.current.shouldShowFooter(config.group)).toBe(expected.shouldShowFooter);
			});
		};

		const shouldShowFooterTests = [
			{
				description: 'shows footer for confirmed when not on last page in normal mode',
				config: {
					historyConfig: {
						...HISTORY_CONFIG_TRANSACTIONS,
						transactionHistory: createTransactionHistoryMock({
							confirmed: CONFIRMED_TRANSACTIONS,
							isLastPage: false
						})
					},
					group: TransactionGroup.CONFIRMED
				},
				expected: { shouldShowFooter: true }
			},
			{
				description: 'hides footer for confirmed on last page in normal mode',
				config: {
					historyConfig: {
						...HISTORY_CONFIG_TRANSACTIONS,
						transactionHistory: createTransactionHistoryMock({
							confirmed: CONFIRMED_TRANSACTIONS,
							isLastPage: true
						})
					},
					group: TransactionGroup.CONFIRMED
				},
				expected: { shouldShowFooter: false }
			},
			{
				description: 'shows footer for receipts when not on last page in harvested mode',
				config: {
					historyConfig: {
						...HISTORY_CONFIG_RECEIPTS,
						receiptHistory: createReceiptHistoryMock({
							receipts: HARVESTING_RECEIPTS,
							isLastPage: false
						})
					},
					filter: { harvested: true },
					group: SectionType.RECEIPTS
				},
				expected: { shouldShowFooter: true }
			}
		];

		shouldShowFooterTests.forEach(test => {
			runShouldShowFooterTest(test.description, test.config, test.expected);
		});
	});

	describe('pagination', () => {
		it('calls transaction history fetchNextPage when hook is ready', async () => {
			// Arrange:
			const transactionHistory = createTransactionHistoryMock();
			mockHistoryHooks({
				transactionHistory,
				receiptHistory: createReceiptHistoryMock()
			});
			const walletController = mockWalletControllerConfigured();
			const { result } = renderHook(() => useHistoryData({ walletController }));

			// Act:
			await act(async () => {
				result.current.fetchNextPage();
			});

			// Assert:
			expect(transactionHistory.fetchNextPage).toHaveBeenCalledTimes(1);
		});

		it('defers fetchNextPage while loading and executes after loading is completed', () => {
			// Arrange:
			const transactionHistory = createTransactionHistoryMock();
			mockHistoryHooks({
				transactionHistory,
				receiptHistory: createReceiptHistoryMock()
			});
			hooks.useLoading.mockReturnValue(LoadingState.INITIAL_LOADING);
			const walletController = mockWalletControllerConfigured();
			const { result, rerender } = renderHook(() => useHistoryData({ walletController }));

			// Act:
			act(() => {
				result.current.fetchNextPage();
			});
			expect(transactionHistory.fetchNextPage).not.toHaveBeenCalled();

			hooks.useLoading.mockReturnValue(LoadingState.IDLE);
			rerender();

			// Assert:
			expect(transactionHistory.fetchNextPage).toHaveBeenCalledTimes(1);
		});

		it('calls receipt history fetchNextPage in harvested mode', async () => {
			// Arrange:
			const transactionHistory = createTransactionHistoryMock();
			const receiptHistory = createReceiptHistoryMock();
			mockHistoryHooks({ transactionHistory, receiptHistory });
			const walletController = mockWalletControllerConfigured();
			const { result } = renderHook(() => useHistoryData({ walletController }));

			// Act:
			act(() => {
				result.current.setFilter({ harvested: true });
			});
			await act(async () => {
				result.current.fetchNextPage();
			});

			// Assert:
			expect(receiptHistory.fetchNextPage).toHaveBeenCalledTimes(1);
			expect(transactionHistory.fetchNextPage).not.toHaveBeenCalled();
		});
	});

	describe('history selection and delegation', () => {
		it('delegates refresh to transaction history in normal mode', async () => {
			// Arrange:
			const transactionHistory = createTransactionHistoryMock();
			mockHistoryHooks({
				transactionHistory,
				receiptHistory: createReceiptHistoryMock()
			});
			const walletController = mockWalletControllerConfigured();
			const { result } = renderHook(() => useHistoryData({ walletController }));

			// Act:
			await act(async () => {
				await result.current.refresh();
			});

			// Assert:
			expect(transactionHistory.refresh).toHaveBeenCalledTimes(1);
		});

		it('delegates refresh to receipt history in harvested mode', async () => {
			// Arrange:
			const transactionHistory = createTransactionHistoryMock();
			const receiptHistory = createReceiptHistoryMock();
			mockHistoryHooks({ transactionHistory, receiptHistory });
			const walletController = mockWalletControllerConfigured();
			const { result } = renderHook(() => useHistoryData({ walletController }));

			// Act:
			act(() => {
				result.current.setFilter({ harvested: true });
			});
			await act(async () => {
				await result.current.refresh();
			});

			// Assert:
			expect(receiptHistory.refresh).toHaveBeenCalledTimes(1);
			expect(transactionHistory.refresh).not.toHaveBeenCalled();
		});

		it('returns isLastPage from selected history', () => {
			// Arrange:
			const transactionHistory = createTransactionHistoryMock({ isLastPage: true });
			mockHistoryHooks({
				transactionHistory,
				receiptHistory: createReceiptHistoryMock({ isLastPage: false })
			});
			const walletController = mockWalletControllerConfigured();

			// Act:
			const { result } = renderHook(() => useHistoryData({ walletController }));

			// Assert:
			expect(result.current.isLastPage).toBe(true);
		});
	});

	describe('hook composition', () => {
		it('calls useInit with selected history resetAndRefresh and current account dependency', () => {
			// Arrange:
			const transactionHistory = createTransactionHistoryMock();
			mockHistoryHooks({
				transactionHistory,
				receiptHistory: createReceiptHistoryMock()
			});
			const walletController = mockWalletControllerConfigured();

			// Act:
			renderHook(() => useHistoryData({ walletController }));

			// Assert:
			expect(hooks.useInit).toHaveBeenCalledWith(
				transactionHistory.resetAndRefresh,
				true,
				[currentAccount.publicKey, {}]
			);
		});

		it('calls useTransactionListener with selected refresh callback', () => {
			// Arrange:
			const transactionHistory = createTransactionHistoryMock();
			mockHistoryHooks({
				transactionHistory,
				receiptHistory: createReceiptHistoryMock()
			});
			const walletController = mockWalletControllerConfigured();

			// Act:
			renderHook(() => useHistoryData({ walletController }));

			// Assert:
			expect(hooks.useTransactionListener).toHaveBeenCalledWith({
				walletControllers: [walletController],
				onTransactionUnconfirmed: transactionHistory.refresh,
				onTransactionPartial: transactionHistory.refresh,
				onTransactionConfirmed: transactionHistory.refresh,
				onTransactionError: transactionHistory.refresh,
				deps: [walletController, transactionHistory.refresh]
			});
		});

		it('calls useTransactionHistory with current filter', () => {
			// Arrange:
			const walletController = mockWalletControllerConfigured();

			// Act:
			renderHook(() => useHistoryData({ walletController }));

			// Assert:
			expect(useTransactionHistory).toHaveBeenCalledWith({ filter: {} });
		});

		it('returns default non-paginated state from fixture-backed empty histories', () => {
			// Arrange:
			mockHistoryHooks(HISTORY_CONFIG_EMPTY);
			const walletController = mockWalletControllerConfigured();

			// Act:
			const { result } = renderHook(() => useHistoryData({ walletController }));

			// Assert:
			expect(result.current.sections).toEqual([]);
			expect(result.current.isLastPage).toBe(false);
			expect(result.current.isPageLoading).toBe(false);
			expect(FIRST_PAGE).toBe(1);
		});
	});
});
