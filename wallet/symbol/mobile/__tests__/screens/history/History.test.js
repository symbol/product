import { TransactionGroup } from '@/app/constants';
import { History } from '@/app/screens/history/History';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AggregateTransactionFixtureBuilder } from '__fixtures__/local/AggregateTransactionFixtureBuilde';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { ReceiptFixtureBuilder } from '__fixtures__/local/ReceiptFixtureBuilder';
import { TransferTransactionFixtureBuilder } from '__fixtures__/local/TransferTransactionFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockOs, mockRouter, mockWalletController } from '__tests__/mock-helpers';

// Mocks

jest.mock('@react-navigation/native', () => ({
	...jest.requireActual('@react-navigation/native'),
	useIsFocused: () => true,
	useNavigation: () => ({
		navigate: jest.fn(),
		goBack: jest.fn()
	})
}));

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const TICKER = 'XYM';

// Screen Text

const SCREEN_TEXT = {
	// Section titles
	textSectionPartial: 'transactionGroup_partial',
	textSectionUnconfirmed: 'transactionGroup_unconfirmed',
	textSectionConfirmed: 'transactionGroup_confirmed',
	textSectionHarvested: 'transactionGroup_harvested',

	// Empty state
	textEmptyList: 'message_emptyList',

	// Filter labels
	textFilterType: 's_history_filter_type',
	textFilterFrom: 's_history_filter_from',
	textFilterTo: 's_history_filter_to',
	textFilterHarvested: 's_history_filter_harvested',
	textFilterBlocked: 's_history_filter_blocked',
	textFilterClear: 'button_clear',

	// Filter options
	textFilterOptionTransfer: 'transactionDescriptor_16724',
	textFilterOptionAggregateBonded: 'transactionDescriptor_16961',
	textFilterOptionAggregateComplete: 'transactionDescriptor_16705',

	// Transaction statuses
	textAwaitingSignature: 'transactionDescriptionShort_awaitingAccountSignature',

	// Transaction types for item verification
	textTransactionOutgoing: 'transactionDescriptor_16724_outgoing',
	textTransactionIncoming: 'transactionDescriptor_16724_incoming',

	// Receipt types
	textReceiptHarvestingReward: 'receiptDescriptor_harvestingReward'
};

// Account Fixtures

const currentAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const recipientAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.build();

const cosignerAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 2)
	.build();
	

const walletAccounts = [currentAccount];

// Network Properties Fixtures

const networkProperties = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME, NETWORK_IDENTIFIER)
	.build();

// Address Book Contacts Fixtures

const whitelistContact = {
	address: recipientAccount.address,
	name: 'Whitelist Contact',
	isBlackListed: false
};

const blacklistContact = {
	address: cosignerAccount.address,
	name: 'Blacklist Contact',
	isBlackListed: true
};

// Blocked Transaction Fixtures (transactions from blacklisted addresses)

const blockedTransfer = TransferTransactionFixtureBuilder
	.createDefault(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setHash('HASH_BLOCKED_1')
	.setHeight(100002)
	.setSigner(cosignerAccount)
	.setRecipientAddress(currentAccount.address)
	.setAmount('200')
	.build();

// Transfer Transaction Fixtures

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
	.setAmount('50')
	.build();

const unconfirmedTransfer = TransferTransactionFixtureBuilder
	.createDefault(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setHash('HASH_UNCONFIRMED_1')
	.setHeight(0)
	.setAmount('-25')
	.build();

// Inner Transfer Transaction Fixtures

const innerTransferSignedByOtherAccount = TransferTransactionFixtureBuilder
	.createDefault(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setSigner(recipientAccount)
	.setRecipientAddress(currentAccount.address)
	.setAmount('0')
	.build();

const innerTransferSignedByCurrentAccount = TransferTransactionFixtureBuilder
	.createDefault(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setSigner(currentAccount)
	.setRecipientAddress(recipientAccount.address)
	.setAmount('0')
	.build();

// Aggregate Transaction Fixtures

const partialTransactionAwaitingSignature = AggregateTransactionFixtureBuilder
	.createDefaultBonded(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setHash('HASH_PARTIAL_AWAITING')
	.setSigner(recipientAccount)
	.setInnerTransactions([innerTransferSignedByOtherAccount])
	.build();

const partialTransactionWithCosignature = AggregateTransactionFixtureBuilder
	.createDefaultBonded(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setHash('HASH_PARTIAL_COSIGNED')
	.setSigner(recipientAccount)
	.addCosignature(currentAccount)
	.setInnerTransactions([innerTransferSignedByOtherAccount])
	.build();

const partialTransactionSignedByCurrentAccount = AggregateTransactionFixtureBuilder
	.createDefaultBonded(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setHash('HASH_PARTIAL_SIGNED')
	.setSigner(currentAccount)
	.setInnerTransactions([innerTransferSignedByCurrentAccount])
	.build();

// Receipt Fixtures

const harvestingReceipt1 = ReceiptFixtureBuilder
	.createHarvestingReward('1000', 200000)
	.build();

const harvestingReceipt2 = ReceiptFixtureBuilder
	.createHarvestingReward('500', 200001)
	.build();

// Transaction Collections

const confirmedTransactions = [confirmedTransfer1, confirmedTransfer2];
const unconfirmedTransactions = [unconfirmedTransfer];
const partialTransactions = [partialTransactionAwaitingSignature];
const harvestingReceipts = [harvestingReceipt1, harvestingReceipt2];
const blockedTransactions = [blockedTransfer];

const selectFilterTransferTransaction = TransferTransactionFixtureBuilder
	.createDefault(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setHash('HASH_SELECT_TRANSFER')
	.setAmount('-111')
	.build();

const selectFilterAggregateBondedTransaction = AggregateTransactionFixtureBuilder
	.createDefaultBonded(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setHash('HASH_SELECT_AGGREGATE_BONDED')
	.setAmount('222')
	.build();

const selectFilterAggregateCompleteTransaction = AggregateTransactionFixtureBuilder
	.createDefaultComplete(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setHash('HASH_SELECT_AGGREGATE_COMPLETE')
	.setAmount('333')
	.build();

const addressFilterFromMatchingTransaction = TransferTransactionFixtureBuilder
	.createDefault(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setHash('HASH_ADDRESS_FROM_MATCH')
	.setSigner(recipientAccount)
	.setRecipientAddress(currentAccount.address)
	.setAmount('-401')
	.build();

const addressFilterFromNonMatchingTransaction = TransferTransactionFixtureBuilder
	.createDefault(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setHash('HASH_ADDRESS_FROM_NO_MATCH')
	.setSigner(cosignerAccount)
	.setRecipientAddress(currentAccount.address)
	.setAmount('-402')
	.build();

const addressFilterToMatchingTransaction = TransferTransactionFixtureBuilder
	.createDefault(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setHash('HASH_ADDRESS_TO_MATCH')
	.setSigner(currentAccount)
	.setRecipientAddress(recipientAccount.address)
	.setAmount('-501')
	.build();

const addressFilterToNonMatchingTransaction = TransferTransactionFixtureBuilder
	.createDefault(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setHash('HASH_ADDRESS_TO_NO_MATCH')
	.setSigner(currentAccount)
	.setRecipientAddress(cosignerAccount.address)
	.setAmount('-502')
	.build();

// Mock Creators

const createAddressBookMock = (overrides = {}) => {
	const blackList = overrides.blackList ?? [];
	const whiteList = overrides.whiteList ?? [];
	const contacts = [...whiteList, ...blackList];

	return {
		whiteList,
		blackList,
		contacts,
		getContactByAddress: jest.fn().mockImplementation(address => {
			return contacts.find(c => c.address === address) || null;
		})
	};
};

const createHarvestingModuleMock = (receipts = []) => ({
	fetchAccountHarvestedBlocks: jest.fn().mockResolvedValue(receipts)
});

const createFetchAccountTransactionsMock = (config = {}) => {
	const { confirmed = [], unconfirmed = [], partial = [] } = config;

	return jest.fn().mockImplementation(({ group }) => {
		switch (group) {
		case TransactionGroup.CONFIRMED:
			return Promise.resolve(confirmed);
		case TransactionGroup.UNCONFIRMED:
			return Promise.resolve(unconfirmed);
		case TransactionGroup.PARTIAL:
			return Promise.resolve(partial);
		default:
			return Promise.resolve([]);
		}
	});
};

// Wallet Controller Configurations

const mockWalletControllerConfigured = (overrides = {}) => {
	const defaultMock = {
		chainName: CHAIN_NAME,
		networkIdentifier: NETWORK_IDENTIFIER,
		ticker: TICKER,
		accounts: {
			testnet: walletAccounts,
			mainnet: []
		},
		currentAccount,
		currentAccountLatestTransactions: [],
		networkProperties,
		isWalletReady: true,
		modules: {
			addressBook: createAddressBookMock(),
			harvesting: createHarvestingModuleMock()
		},
		fetchAccountTransactions: createFetchAccountTransactionsMock(),
		...overrides
	};

	if (overrides.modules) {
		defaultMock.modules = {
			...defaultMock.modules,
			...overrides.modules
		};
	}

	return mockWalletController(defaultMock);
};

describe('screens/history/History', () => {
	beforeEach(() => {
		mockLocalization();
		mockOs('android');
		mockRouter({ goToTransactionDetails: jest.fn() });
		jest.clearAllMocks();
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('render', () => {
		it('renders all filter labels', async () => {
			// Arrange:
			mockWalletControllerConfigured();
			const expectedTexts = [
				SCREEN_TEXT.textFilterType,
				SCREEN_TEXT.textFilterFrom,
				SCREEN_TEXT.textFilterTo,
				SCREEN_TEXT.textFilterHarvested,
				SCREEN_TEXT.textFilterBlocked,
				SCREEN_TEXT.textFilterClear
			];

			// Act:
			const screenTester = new ScreenTester(History);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText(expectedTexts);
		});

		it('renders cached transactions before fetch completes', () => {
			// Arrange:
			mockWalletControllerConfigured({
				currentAccountLatestTransactions: confirmedTransactions,
				fetchAccountTransactions: jest.fn().mockReturnValue(new Promise(() => {}))
			});

			// Act:
			const screenTester = new ScreenTester(History);

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textSectionConfirmed]);
		});

		it('renders fetched transactions after fetch completes', async () => {
			// Arrange:
			mockWalletControllerConfigured({
				currentAccountLatestTransactions: [],
				fetchAccountTransactions: createFetchAccountTransactionsMock({
					confirmed: confirmedTransactions
				})
			});

			// Act:
			const screenTester = new ScreenTester(History);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textSectionConfirmed]);
		});
	});

	describe('filters', () => {
		const runDropdownFilterTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				mockWalletControllerConfigured({
					fetchAccountTransactions: createFetchAccountTransactionsMock({
						confirmed: config.transactions
					}),
					modules: {
						addressBook: createAddressBookMock({
							whiteList: config.whiteList ?? []
						}),
						harvesting: createHarvestingModuleMock()
					}
				});

				// Act:
				const screenTester = new ScreenTester(History);
				await screenTester.waitForTimer();
				screenTester.pressButton(config.filterLabel);
				await screenTester.waitForTimer();
				screenTester.pressButton(config.optionLabel, config.optionIndex);
				await screenTester.waitForTimer();

				// Assert: verify correct section visibility
				if (expected.isConfirmedSectionVisible)
					screenTester.expectText([SCREEN_TEXT.textSectionConfirmed]);
				else
					screenTester.notExpectText([SCREEN_TEXT.textSectionConfirmed]);

				screenTester.notExpectText([SCREEN_TEXT.textSectionHarvested]);

				// Assert: verify correct number of transactions rendered
				screenTester.expectTextCount(SCREEN_TEXT.textSectionConfirmed, expected.renderedItems.length > 0 ? 1 : 0);
				const renderedAmounts = expected.renderedItems.map(tx => tx.amount);
				screenTester.expectText(renderedAmounts);
			});
		};

		const runToggleFilterTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				mockWalletControllerConfigured({
					fetchAccountTransactions: createFetchAccountTransactionsMock({
						confirmed: config.transactions ?? []
					}),
					modules: {
						addressBook: createAddressBookMock({
							blackList: config.blackList ?? []
						}),
						harvesting: createHarvestingModuleMock(config.receipts ?? [])
					}
				});

				// Act:
				const screenTester = new ScreenTester(History);
				await screenTester.waitForTimer();

				if (config.enableFilter) {
					screenTester.pressButton(config.filterLabel);
					await screenTester.waitForTimer();
				}

				// Assert: verify visible sections
				if (expected.visibleSections?.length > 0)
					screenTester.expectText(expected.visibleSections);

				// Assert: verify hidden sections
				if (expected.hiddenSections?.length > 0)
					screenTester.notExpectText(expected.hiddenSections);

				const renderedAmounts = expected.renderedItems.map(tx => tx.amount);
				screenTester.expectText(renderedAmounts);

			});
		};

		describe('harvesting receipts', () => {
			const harvestingFilterTests = [
				{
					description: 'switches to harvested receipts view when harvested filter is pressed',
					config: {
						filterLabel: SCREEN_TEXT.textFilterHarvested,
						enableFilter: true,
						transactions: confirmedTransactions,
						receipts: harvestingReceipts
					},
					expected: {
						visibleSections: [SCREEN_TEXT.textSectionHarvested],
						hiddenSections: [
							SCREEN_TEXT.textSectionConfirmed,
							SCREEN_TEXT.textSectionUnconfirmed,
							SCREEN_TEXT.textSectionPartial
						],
						renderedItems: harvestingReceipts
					}
				},
				{
					description: 'shows no harvested items when harvested filter is enabled without receipts',
					config: {
						filterLabel: SCREEN_TEXT.textFilterHarvested,
						enableFilter: true,
						transactions: confirmedTransactions,
						receipts: []
					},
					expected: {
						visibleSections: [],
						hiddenSections: [
							SCREEN_TEXT.textSectionConfirmed,
							SCREEN_TEXT.textSectionUnconfirmed,
							SCREEN_TEXT.textSectionPartial,
							SCREEN_TEXT.textSectionHarvested
						],
						renderedItems: []
					}
				}
			];

			harvestingFilterTests.forEach(test => {
				runToggleFilterTest(test.description, test.config, test.expected);
			});
		});

		describe('transactions from blocked accounts', () => {
			const allTransactionsIncludingBlocked = [...confirmedTransactions, blockedTransfer];

			const blockedFilterTests = [
				{
					description: 'shows only non-blocked transactions when blocked filter is disabled',
					config: {
						filterLabel: SCREEN_TEXT.textFilterBlocked,
						transactions: allTransactionsIncludingBlocked,
						blackList: [blacklistContact],
						enableFilter: false
					},
					expected: {
						visibleSections: [SCREEN_TEXT.textSectionConfirmed],
						hiddenSections: [SCREEN_TEXT.textSectionHarvested],
						renderedItems: confirmedTransactions
					}
				},
				{
					description: 'shows only blocked transactions when blocked filter is enabled',
					config: {
						filterLabel: SCREEN_TEXT.textFilterBlocked,
						transactions: allTransactionsIncludingBlocked,
						blackList: [blacklistContact],
						enableFilter: true
					},
					expected: {
						visibleSections: [SCREEN_TEXT.textSectionConfirmed],
						hiddenSections: [SCREEN_TEXT.textSectionHarvested],
						renderedItems: blockedTransactions
					}
				},
				{
					description: 'shows empty list when blocked filter is enabled but no blocked transactions exist',
					config: {
						filterLabel: SCREEN_TEXT.textFilterBlocked,
						transactions: confirmedTransactions,
						blackList: [blacklistContact],
						enableFilter: true
					},
					expected: {
						visibleSections: [],
						hiddenSections: [SCREEN_TEXT.textSectionConfirmed, SCREEN_TEXT.textSectionHarvested],
						renderedItems: []
					}
				},
				{
					description: 'shows all transactions when blacklist is empty regardless of filter state',
					config: {
						filterLabel: SCREEN_TEXT.textFilterBlocked,
						transactions: allTransactionsIncludingBlocked,
						blackList: [],
						enableFilter: false
					},
					expected: {
						visibleSections: [SCREEN_TEXT.textSectionConfirmed],
						hiddenSections: [SCREEN_TEXT.textSectionHarvested],
						renderedItems: allTransactionsIncludingBlocked
					}
				}
			];

			blockedFilterTests.forEach(test => {
				runToggleFilterTest(test.description, test.config, test.expected);
			});
		});

		describe('transaction type', () => {
			const selectFilterTests = [
				{
					description: 'filters by transfer type when transfer option is selected',
					config: {
						filterLabel: SCREEN_TEXT.textFilterType,
						optionLabel: SCREEN_TEXT.textFilterOptionTransfer,
						transactions: [
							selectFilterTransferTransaction,
							selectFilterAggregateBondedTransaction,
							selectFilterAggregateCompleteTransaction
						]
					},
					expected: {
						isConfirmedSectionVisible: true,
						renderedItems: [selectFilterTransferTransaction]
					}
				},
				{
					description: 'filters by aggregate bonded type when option is selected',
					config: {
						filterLabel: SCREEN_TEXT.textFilterType,
						optionLabel: SCREEN_TEXT.textFilterOptionAggregateBonded,
						optionIndex: 1,
						transactions: [
							selectFilterTransferTransaction,
							selectFilterAggregateBondedTransaction,
							selectFilterAggregateCompleteTransaction
						]
					},
					expected: {
						isConfirmedSectionVisible: true,
						renderedItems: [selectFilterAggregateBondedTransaction]
					}
				},
				{
					description: 'filters by aggregate complete type when option is selected',
					config: {
						filterLabel: SCREEN_TEXT.textFilterType,
						optionLabel: SCREEN_TEXT.textFilterOptionAggregateComplete,
						optionIndex: 1,
						transactions: [
							selectFilterTransferTransaction,
							selectFilterAggregateBondedTransaction,
							selectFilterAggregateCompleteTransaction
						]
					},
					expected: {
						isConfirmedSectionVisible: true,
						renderedItems: [selectFilterAggregateCompleteTransaction]
					}
				}
			];

			selectFilterTests.forEach(test => {
				runDropdownFilterTest(test.description, test.config, test.expected);
			});
		});

		describe('from and to', () => {
			const addressFilterTests = [
				{
					description: 'filters by sender address when from filter option is selected',
					config: {
						filterLabel: SCREEN_TEXT.textFilterFrom,
						optionLabel: recipientAccount.address,
						whiteList: [whitelistContact],
						transactions: [
							addressFilterFromMatchingTransaction,
							addressFilterFromNonMatchingTransaction
						]
					},
					expected: {
						isConfirmedSectionVisible: true,
						renderedItems: [addressFilterFromMatchingTransaction]
					}
				},
				{
					description: 'filters by recipient address when to filter option is selected',
					config: {
						filterLabel: SCREEN_TEXT.textFilterTo,
						optionLabel: recipientAccount.address,
						whiteList: [whitelistContact],
						transactions: [
							addressFilterToMatchingTransaction,
							addressFilterToNonMatchingTransaction
						]
					},
					expected: {
						isConfirmedSectionVisible: true,
						renderedItems: [addressFilterToMatchingTransaction]
					}
				}
			];

			addressFilterTests.forEach(test => {
				runDropdownFilterTest(test.description, test.config, test.expected);
			});
		});
	});

	describe('sections', () => {
		const runSectionVisibilityTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				mockWalletControllerConfigured({
					fetchAccountTransactions: createFetchAccountTransactionsMock({
						confirmed: config.confirmed ?? [],
						unconfirmed: config.unconfirmed ?? [],
						partial: config.partial ?? []
					}),
					modules: {
						addressBook: createAddressBookMock(),
						harvesting: createHarvestingModuleMock(config.harvested ?? [])
					}
				});

				// Act:
				const screenTester = new ScreenTester(History);
				await screenTester.waitForTimer();

				if (config.enableHarvestedFilter) {
					screenTester.pressButton(SCREEN_TEXT.textFilterHarvested);
					await screenTester.waitForTimer();
				}

				// Assert: verify visible sections
				if (expected.visibleSections.length > 0)
					screenTester.expectText(expected.visibleSections);

				// Assert: verify hidden sections
				if (expected.hiddenSections.length > 0)
					screenTester.notExpectText(expected.hiddenSections);

				// Assert: verify correct number of list items rendered
				if (expected.expectedItemCount !== undefined)
					screenTester.expectTextCount(expected.itemIdentifier, expected.expectedItemCount);
			});
		};

		const sectionVisibilityTests = [
			{
				description: 'renders only confirmed section when only confirmed transactions exist',
				config: {
					confirmed: confirmedTransactions,
					unconfirmed: [],
					partial: []
				},
				expected: {
					visibleSections: [SCREEN_TEXT.textSectionConfirmed],
					hiddenSections: [
						SCREEN_TEXT.textSectionUnconfirmed,
						SCREEN_TEXT.textSectionPartial,
						SCREEN_TEXT.textSectionHarvested
					],
					itemIdentifier: SCREEN_TEXT.textTransactionOutgoing,
					expectedItemCount: confirmedTransactions.length
				}
			},
			{
				description: 'renders only unconfirmed section when only unconfirmed transactions exist',
				config: {
					confirmed: [],
					unconfirmed: unconfirmedTransactions,
					partial: []
				},
				expected: {
					visibleSections: [SCREEN_TEXT.textSectionUnconfirmed],
					hiddenSections: [
						SCREEN_TEXT.textSectionConfirmed,
						SCREEN_TEXT.textSectionPartial,
						SCREEN_TEXT.textSectionHarvested
					],
					itemIdentifier: SCREEN_TEXT.textTransactionOutgoing,
					expectedItemCount: unconfirmedTransactions.length
				}
			},
			{
				description: 'renders only partial section when only partial transactions exist',
				config: {
					confirmed: [],
					unconfirmed: [],
					partial: partialTransactions
				},
				expected: {
					visibleSections: [SCREEN_TEXT.textSectionPartial],
					hiddenSections: [
						SCREEN_TEXT.textSectionConfirmed,
						SCREEN_TEXT.textSectionUnconfirmed,
						SCREEN_TEXT.textSectionHarvested
					]
				}
			},
			{
				description: 'renders only harvested section when harvested filter is enabled with receipts',
				config: {
					confirmed: confirmedTransactions,
					unconfirmed: unconfirmedTransactions,
					partial: partialTransactions,
					harvested: harvestingReceipts,
					enableHarvestedFilter: true
				},
				expected: {
					visibleSections: [SCREEN_TEXT.textSectionHarvested],
					hiddenSections: [
						SCREEN_TEXT.textSectionConfirmed,
						SCREEN_TEXT.textSectionUnconfirmed,
						SCREEN_TEXT.textSectionPartial
					],
					itemIdentifier: SCREEN_TEXT.textReceiptHarvestingReward,
					expectedItemCount: harvestingReceipts.length
				}
			},
			{
				description: 'renders all transaction sections when all types exist',
				config: {
					confirmed: confirmedTransactions,
					unconfirmed: unconfirmedTransactions,
					partial: partialTransactions
				},
				expected: {
					visibleSections: [
						SCREEN_TEXT.textSectionConfirmed,
						SCREEN_TEXT.textSectionUnconfirmed,
						SCREEN_TEXT.textSectionPartial
					],
					hiddenSections: [SCREEN_TEXT.textSectionHarvested]
				}
			},
			{
				description: 'renders confirmed and unconfirmed sections when both exist',
				config: {
					confirmed: confirmedTransactions,
					unconfirmed: unconfirmedTransactions,
					partial: []
				},
				expected: {
					visibleSections: [
						SCREEN_TEXT.textSectionConfirmed,
						SCREEN_TEXT.textSectionUnconfirmed
					],
					hiddenSections: [
						SCREEN_TEXT.textSectionPartial,
						SCREEN_TEXT.textSectionHarvested
					]
				}
			},
			{
				description: 'renders confirmed and partial sections when both exist',
				config: {
					confirmed: confirmedTransactions,
					unconfirmed: [],
					partial: partialTransactions
				},
				expected: {
					visibleSections: [
						SCREEN_TEXT.textSectionConfirmed,
						SCREEN_TEXT.textSectionPartial
					],
					hiddenSections: [
						SCREEN_TEXT.textSectionUnconfirmed,
						SCREEN_TEXT.textSectionHarvested
					]
				}
			},
			{
				description: 'renders unconfirmed and partial sections when both exist',
				config: {
					confirmed: [],
					unconfirmed: unconfirmedTransactions,
					partial: partialTransactions
				},
				expected: {
					visibleSections: [
						SCREEN_TEXT.textSectionUnconfirmed,
						SCREEN_TEXT.textSectionPartial
					],
					hiddenSections: [
						SCREEN_TEXT.textSectionConfirmed,
						SCREEN_TEXT.textSectionHarvested
					]
				}
			},
			{
				description: 'renders no sections when no transactions exist',
				config: {
					confirmed: [],
					unconfirmed: [],
					partial: []
				},
				expected: {
					visibleSections: [],
					hiddenSections: [
						SCREEN_TEXT.textSectionConfirmed,
						SCREEN_TEXT.textSectionUnconfirmed,
						SCREEN_TEXT.textSectionPartial,
						SCREEN_TEXT.textSectionHarvested
					]
				}
			}
		];

		sectionVisibilityTests.forEach(test => {
			runSectionVisibilityTest(test.description, test.config, test.expected);
		});
	});

	describe('multisig transactions', () => {
		const runMultisigSignatureTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				mockWalletControllerConfigured({
					currentAccount: config.currentAccount,
					fetchAccountTransactions: createFetchAccountTransactionsMock({
						partial: [config.transaction]
					})
				});

				// Act:
				const screenTester = new ScreenTester(History);
				await screenTester.waitForTimer();

				// Assert:
				if (expected.shouldShowAwaitingSignature)
					screenTester.expectText([SCREEN_TEXT.textAwaitingSignature]);
				else
					screenTester.notExpectText([SCREEN_TEXT.textAwaitingSignature]);
			});
		};

		const multisigSignatureTests = [
			{
				description: 'displays awaiting signature text when current account has not signed',
				config: {
					currentAccount,
					transaction: partialTransactionAwaitingSignature
				},
				expected: { shouldShowAwaitingSignature: true }
			},
			{
				description: 'hides awaiting signature text when current account has cosigned',
				config: {
					currentAccount,
					transaction: partialTransactionWithCosignature
				},
				expected: { shouldShowAwaitingSignature: false }
			},
			{
				description: 'hides awaiting signature text when current account is the signer',
				config: {
					currentAccount,
					transaction: partialTransactionSignedByCurrentAccount
				},
				expected: { shouldShowAwaitingSignature: false }
			}
		];

		multisigSignatureTests.forEach(test => {
			runMultisigSignatureTest(test.description, test.config, test.expected);
		});
	});

	describe('navigation', () => {
		it('navigates to transaction details when a transaction is pressed', async () => {
			// Arrange:
			const routerMock = mockRouter({ goToTransactionDetails: jest.fn() });
			mockWalletControllerConfigured({
				fetchAccountTransactions: createFetchAccountTransactionsMock({
					confirmed: [confirmedTransfer1]
				})
			});

			// Act:
			const screenTester = new ScreenTester(History);
			await screenTester.waitForTimer();
			screenTester.pressButton(SCREEN_TEXT.textTransactionOutgoing);

			// Assert:
			expect(routerMock.goToTransactionDetails).toHaveBeenCalledWith({
				params: {
					transaction: confirmedTransfer1,
					chainName: CHAIN_NAME,
					group: TransactionGroup.CONFIRMED
				}
			});
		});
	});

	describe('empty list', () => {
		const runEmptyListTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				mockWalletControllerConfigured({
					fetchAccountTransactions: createFetchAccountTransactionsMock({
						confirmed: config.confirmed ?? [],
						unconfirmed: config.unconfirmed ?? [],
						partial: config.partial ?? []
					}),
					modules: {
						addressBook: createAddressBookMock(),
						harvesting: createHarvestingModuleMock(config.receipts ?? [])
					}
				});

				// Act:
				const screenTester = new ScreenTester(History);
				await screenTester.waitForTimer();

				if (config.enableHarvestedFilter) {
					screenTester.pressButton(SCREEN_TEXT.textFilterHarvested);
					await screenTester.waitForTimer();
				}

				// Assert:
				if (expected.shouldShowEmptyList)
					screenTester.expectText([SCREEN_TEXT.textEmptyList]);
				else
					screenTester.notExpectText([SCREEN_TEXT.textEmptyList]);
			});
		};

		const emptyListTests = [
			{
				description: 'displays empty list message when no transactions exist',
				config: {
					confirmed: [],
					unconfirmed: [],
					partial: []
				},
				expected: { shouldShowEmptyList: true }
			},
			{
				description: 'displays empty list message when harvested filter is enabled with no receipts',
				config: {
					confirmed: confirmedTransactions,
					unconfirmed: [],
					partial: [],
					receipts: [],
					enableHarvestedFilter: true
				},
				expected: { shouldShowEmptyList: true }
			},
			{
				description: 'hides empty list message when confirmed transactions exist',
				config: {
					confirmed: confirmedTransactions,
					unconfirmed: [],
					partial: []
				},
				expected: { shouldShowEmptyList: false }
			},
			{
				description: 'hides empty list message when unconfirmed transactions exist',
				config: {
					confirmed: [],
					unconfirmed: unconfirmedTransactions,
					partial: []
				},
				expected: { shouldShowEmptyList: false }
			},
			{
				description: 'hides empty list message when partial transactions exist',
				config: {
					confirmed: [],
					unconfirmed: [],
					partial: partialTransactions
				},
				expected: { shouldShowEmptyList: false }
			},
			{
				description: 'hides empty list message when harvested filter is enabled with receipts',
				config: {
					confirmed: [],
					unconfirmed: [],
					partial: [],
					receipts: harvestingReceipts,
					enableHarvestedFilter: true
				},
				expected: { shouldShowEmptyList: false }
			}
		];

		emptyListTests.forEach(test => {
			runEmptyListTest(test.description, test.config, test.expected);
		});

		it('does not display empty list message during initial loading', () => {
			// Arrange:
			mockWalletControllerConfigured({
				currentAccountLatestTransactions: [],
				fetchAccountTransactions: jest.fn().mockReturnValue(new Promise(() => {}))
			});

			// Act:
			const screenTester = new ScreenTester(History);

			// Assert:
			screenTester.notExpectText([SCREEN_TEXT.textEmptyList]);
		});
	});
});
