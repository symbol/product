import { Harvesting } from '@/app/screens/harvesting/Harvesting';
import { formatDate } from '@/app/utils';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AccountInfoFixtureBuilder } from '__fixtures__/local/AccountInfoFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { TransactionFeeFixtureBuilder } from '__fixtures__/local/TransactionFeeFixtureBuilder';
import { TransactionFixtureBuilder } from '__fixtures__/local/TransactionFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { createWalletControllerMock, mockLocalization, mockPasscode, mockRouter, mockWalletController } from '__tests__/mock-helpers';
import { act } from '@testing-library/react-native';
import { TransactionBundle, constants as coreConstants } from 'wallet-common-core';
import { constants } from 'wallet-common-symbol';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const TICKER = 'XYM';

const NODE_URL = 'https://harvest-node.symbol.network:3001';
const NODE_PUBLIC_KEY = 'E4EAF960E8C4291AF1810F706E16750E3790237FDCF8887B4B0C1854603AD0FF';

const SUMMARY_LATEST_AMOUNT = '12.5';
const SUMMARY_LATEST_HEIGHT = 1234567;
const SUMMARY_LATEST_DATE = 1684265310994;
const SUMMARY_AMOUNT_30_DAYS = '150.75';
const SUMMARY_BLOCKS_30_DAYS = 12;
const SUMMARY_LATEST_DATE_TEXT = formatDate(SUMMARY_LATEST_DATE, key => key, true);
const SUMMARY_BLOCK_NUMBER_TEXT = `#${SUMMARY_LATEST_HEIGHT}`;

const SUMMARY_MULTISIG_LATEST_HEIGHT = 7654321;
const SUMMARY_MULTISIG_BLOCK_NUMBER_TEXT = `#${SUMMARY_MULTISIG_LATEST_HEIGHT}`;

// Enums

const { HarvestingStatus } = constants;
const { ControllerEventName } = coreConstants;

// Screen Text

const SCREEN_TEXT = {
	// Screen titles
	textScreenTitle: 's_harvesting_title',
	textScreenDescription: 's_harvesting_description',

	// Status section
	textStatusTitle: 's_harvesting_status_title',
	textStatusActive: 's_harvesting_status_active',
	textStatusPending: 's_harvesting_status_pending',
	textStatusInactive: 's_harvesting_status_inactive',
	textStatusOperator: 's_harvesting_status_operator',
	textStatusUnknown: 's_harvesting_status_unknown',

	// Status warnings
	textWarningBalance: 's_harvesting_warning_balance',
	textWarningImportance: 's_harvesting_warning_importance',
	textWarningNodeDown: 's_harvesting_warning_node_down',

	// Summary section
	textSummaryTitle: 's_harvesting_harvested_title',
	textSummaryBlockLabel: 's_harvesting_harvested_block_label',
	textSummary30DaysLabel: 's_harvesting_harvested_30days_label',
	textSummaryBlocksCount: 's_harvesting_harvested_blocks',

	// Manage section
	textManageTitle: 's_harvesting_manage_title',
	textNodeUrlField: 'fieldTitle_nodeUrl',

	// Sender selector
	textSenderTitle: 's_harvesting_account_title',
	senderTabCurrentAccount: 'c_selectTransactionSender_currentAccount',
	senderTabMultisigAccount: 'c_selectTransactionSender_multisigAccount',

	// Buttons
	buttonStart: 'button_start',
	buttonStop: 'button_stop',
	buttonConfirm: 'button_confirm'
};

// Account Fixtures

const currentAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const multisigAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 3)
	.build();

// Network Properties Fixtures

const networkProperties = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME, NETWORK_IDENTIFIER)
	.build();

// Account Info Fixtures

const accountInfoEligible = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setBalance('50000')
	.setImportance(100)
	.setLinkedKeys(true, true, true)
	.build();

const accountInfoLowBalance = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setBalance('100')
	.setImportance(100)
	.build();

const accountInfoLowImportance = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setBalance('50000')
	.setImportance(0)
	.build();

const accountInfoNoKeys = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setBalance('50000')
	.setImportance(100)
	.build();

const multisigAccountInfo = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 3)
	.setBalance('5000000')
	.setImportance(100)
	.override({
		address: multisigAccount.address,
		publicKey: multisigAccount.publicKey,
		isMultisig: true
	})
	.build();

// Transaction Fee Fixtures

const transactionFees = TransactionFeeFixtureBuilder
	.createWithAmounts('0.1', '0.2', '0.3', CHAIN_NAME, NETWORK_IDENTIFIER)
	.build();

// Transaction Fixtures

const harvestingTransaction = TransactionFixtureBuilder
	.createDefault(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setType('accountKeyLink')
	.setSignerAddress(currentAccount.address)
	.build();

const transactionBundle = new TransactionBundle([harvestingTransaction]);
transactionBundle.applyFeeTier = jest.fn();

const signedTransactionBundle = new TransactionBundle([{ ...harvestingTransaction, hash: 'SIGNED_TX_HASH' }]);

// Harvesting Status Response Fixtures

const harvestingStatusInactive = {
	status: HarvestingStatus.INACTIVE,
	nodeUrl: null
};

const harvestingStatusActive = {
	status: HarvestingStatus.ACTIVE,
	nodeUrl: NODE_URL
};

const harvestingStatusPending = {
	status: HarvestingStatus.PENDING,
	nodeUrl: NODE_URL
};

const harvestingStatusOperator = {
	status: HarvestingStatus.OPERATOR,
	nodeUrl: NODE_URL
};

const harvestingStatusNodeUnknown = {
	status: HarvestingStatus.NODE_UNKNOWN,
	nodeUrl: NODE_URL
};

// Harvesting Summary Fixtures

const harvestingSummaryEmpty = {
	latestAmount: 0,
	latestHeight: null,
	latestDate: null,
	amountPer30Days: 0,
	blocksHarvestedPer30Days: 0
};

const harvestingSummaryWithData = {
	latestAmount: SUMMARY_LATEST_AMOUNT,
	latestHeight: SUMMARY_LATEST_HEIGHT,
	latestDate: SUMMARY_LATEST_DATE,
	amountPer30Days: SUMMARY_AMOUNT_30_DAYS,
	blocksHarvestedPer30Days: SUMMARY_BLOCKS_30_DAYS
};

const harvestingSummaryMultisig = {
	latestAmount: '3.5',
	latestHeight: SUMMARY_MULTISIG_LATEST_HEIGHT,
	latestDate: SUMMARY_LATEST_DATE,
	amountPer30Days: '20.25',
	blocksHarvestedPer30Days: 4
};

// Harvesting Module Mock Factory

// Like the module, the mock caches the fetched data per account address, and returns the cached data of the
// requested address. The data of one account can therefore never be read as the data of another
const createHarvestingModuleMock = (config = {}) => {
	const {
		statusByAddress = {},
		summaryByAddress = {},
		nodeList = [NODE_URL]
	} = config;
	const statusCache = {};
	const summaryCache = {};

	return {
		fetchStatus: jest.fn(async account => {
			const status = statusByAddress[account.address] ?? harvestingStatusInactive;
			statusCache[account.address] = status;

			return status;
		}),
		fetchSummary: jest.fn(async address => {
			const summary = summaryByAddress[address] ?? harvestingSummaryEmpty;
			summaryCache[address] = summary;

			return summary;
		}),
		fetchNodeList: jest.fn().mockResolvedValue(nodeList),
		getStatus: jest.fn(address => statusCache[address] ?? null),
		getSummary: jest.fn(address => summaryCache[address] ?? null),
		createStartHarvestingTransaction: jest.fn().mockResolvedValue(transactionBundle),
		createStopHarvestingTransaction: jest.fn().mockResolvedValue(transactionBundle)
	};
};

// Network API Mock Factory

const createNetworkApiMock = () => ({
	harvesting: {
		fetchNodeInfo: jest.fn().mockResolvedValue({
			nodePublicKey: NODE_PUBLIC_KEY
		})
	}
});

// Transfer Module Mock Factory

const createTransferModuleMock = () => ({
	calculateTransactionFees: jest.fn().mockResolvedValue(transactionFees)
});

// Multisig Module Mock Factory

const createMultisigModuleMock = (multisigAccounts = []) => ({
	multisigAccounts,
	fetchData: jest.fn().mockResolvedValue(multisigAccounts)
});

// Setup

const setupMocks = (config = {}) => {
	const {
		accountInfo = accountInfoEligible,
		statusResponse = harvestingStatusInactive,
		summaryResponse = harvestingSummaryEmpty,
		multisigStatusResponse = harvestingStatusInactive,
		multisigSummaryResponse = harvestingSummaryEmpty,
		nodeList = [NODE_URL],
		multisigAccounts = []
	} = config;

	const walletControllerMock = createWalletControllerMock({
		chainName: CHAIN_NAME,
		networkIdentifier: NETWORK_IDENTIFIER,
		networkProperties,
		ticker: TICKER,
		isWalletReady: true,
		currentAccount,
		currentAccountInfo: accountInfo,
		fetchAccountInfo: jest.fn().mockResolvedValue(accountInfo),
		signTransactionBundle: jest.fn().mockResolvedValue(signedTransactionBundle),
		announceSignedTransactionBundle: jest.fn().mockResolvedValue({}),
		networkApi: createNetworkApiMock(),
		modules: {
			harvesting: createHarvestingModuleMock({
				statusByAddress: {
					[currentAccount.address]: statusResponse,
					[multisigAccount.address]: multisigStatusResponse
				},
				summaryByAddress: {
					[currentAccount.address]: summaryResponse,
					[multisigAccount.address]: multisigSummaryResponse
				},
				nodeList
			}),
			transfer: createTransferModuleMock(),
			multisig: createMultisigModuleMock(multisigAccounts)
		}
	});

	mockWalletController(walletControllerMock);
	mockLocalization();

	return { walletControllerMock };
};

describe('screens/harvesting/Harvesting', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('render', () => {
		it('renders screen text with titles and descriptions for all sections', async () => {
			// Arrange:
			setupMocks({
				statusResponse: harvestingStatusActive,
				summaryResponse: harvestingSummaryWithData
			});
			const expectedTexts = [
				SCREEN_TEXT.textScreenTitle,
				SCREEN_TEXT.textScreenDescription,
				SCREEN_TEXT.textStatusTitle,
				SCREEN_TEXT.textSummaryTitle,
				SCREEN_TEXT.textSummaryBlockLabel,
				SCREEN_TEXT.textSummary30DaysLabel
			];

			// Act:
			const screenTester = new ScreenTester(Harvesting);
			await screenTester.waitForTimer(); // initial load

			// Assert:
			screenTester.expectText(expectedTexts);
		});
	});

	describe('sender selector', () => {
		const runSenderSelectorTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				setupMocks({ multisigAccounts: config.multisigAccounts });

				// Act:
				const screenTester = new ScreenTester(Harvesting);
				await screenTester.waitForTimer(); // initial load

				// Assert:
				screenTester.expectText([SCREEN_TEXT.textSenderTitle]);

				if (expected.hasMultisigTabs)
					screenTester.expectText([SCREEN_TEXT.senderTabCurrentAccount, SCREEN_TEXT.senderTabMultisigAccount]);
				else
					screenTester.notExpectText([SCREEN_TEXT.senderTabCurrentAccount, SCREEN_TEXT.senderTabMultisigAccount]);
			});
		};

		const senderSelectorTests = [
			{
				description: 'shows sender tab selector when account is cosignatory of multisig accounts',
				config: { multisigAccounts: [multisigAccountInfo] },
				expected: { hasMultisigTabs: true }
			},
			{
				description: 'shows only the current account when there are no multisig accounts',
				config: { multisigAccounts: [] },
				expected: { hasMultisigTabs: false }
			}
		];

		senderSelectorTests.forEach(test => {
			runSenderSelectorTest(test.description, test.config, test.expected);
		});
	});

	describe('status', () => {
		const runStatusTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				setupMocks({
					accountInfo: config.accountInfo,
					statusResponse: config.statusResponse
				});

				// Act:
				const screenTester = new ScreenTester(Harvesting);
				await screenTester.waitForTimer(); // init + fetch account info
				await screenTester.waitForTimer(); // fetch status
				await screenTester.waitForTimer(); // fetch summary + nodes
				await screenTester.waitForTimer(); // debounce + fee calculation

				// Assert:
				screenTester.expectText([expected.statusText]);

				if (expected.warningText)
					screenTester.expectText([expected.warningText]);

				if (expected.isNodeUrlVisible)
					screenTester.expectText([NODE_URL]);
				else
					screenTester.notExpectText([NODE_URL]);

				if (expected.isButtonVisible)
					screenTester.expectText([expected.buttonText]);
				else if (expected.buttonText)
					screenTester.notExpectText([expected.buttonText]);
			});
		};

		const statusTests = [
			{
				description: 'shows importance warning when account has insufficient importance',
				config: {
					accountInfo: accountInfoLowImportance,
					statusResponse: harvestingStatusInactive
				},
				expected: {
					statusText: SCREEN_TEXT.textStatusInactive,
					warningText: SCREEN_TEXT.textWarningImportance,
					isNodeUrlVisible: false,
					isButtonVisible: false,
					buttonText: SCREEN_TEXT.buttonStart
				}
			},
			{
				description: 'shows balance warning when account has insufficient balance',
				config: {
					accountInfo: accountInfoLowBalance,
					statusResponse: harvestingStatusInactive
				},
				expected: {
					statusText: SCREEN_TEXT.textStatusInactive,
					warningText: SCREEN_TEXT.textWarningBalance,
					isNodeUrlVisible: false,
					isButtonVisible: false,
					buttonText: SCREEN_TEXT.buttonStart
				}
			},
			{
				description: 'shows inactive status with start button when eligible and no keys linked',
				config: {
					accountInfo: accountInfoNoKeys,
					statusResponse: harvestingStatusInactive
				},
				expected: {
					statusText: SCREEN_TEXT.textStatusInactive,
					warningText: null,
					isNodeUrlVisible: false,
					isButtonVisible: true,
					buttonText: SCREEN_TEXT.buttonStart
				}
			},
			{
				description: 'shows pending status with node URL and stop button when keys linked',
				config: {
					accountInfo: accountInfoEligible,
					statusResponse: harvestingStatusPending
				},
				expected: {
					statusText: SCREEN_TEXT.textStatusPending,
					warningText: null,
					isNodeUrlVisible: true,
					isButtonVisible: true,
					buttonText: SCREEN_TEXT.buttonStop
				}
			},
			{
				description: 'shows active status with node URL and stop button',
				config: {
					accountInfo: accountInfoEligible,
					statusResponse: harvestingStatusActive
				},
				expected: {
					statusText: SCREEN_TEXT.textStatusActive,
					warningText: null,
					isNodeUrlVisible: true,
					isButtonVisible: true,
					buttonText: SCREEN_TEXT.buttonStop
				}
			},
			{
				description: 'shows operator status with node URL and no button',
				config: {
					accountInfo: accountInfoEligible,
					statusResponse: harvestingStatusOperator
				},
				expected: {
					statusText: SCREEN_TEXT.textStatusOperator,
					warningText: null,
					isNodeUrlVisible: true,
					isButtonVisible: false,
					buttonText: null
				}
			},
			{
				description: 'shows unknown status with node down warning when node is unreachable',
				config: {
					accountInfo: accountInfoEligible,
					statusResponse: harvestingStatusNodeUnknown
				},
				expected: {
					statusText: SCREEN_TEXT.textStatusUnknown,
					warningText: SCREEN_TEXT.textWarningNodeDown,
					isNodeUrlVisible: true,
					isButtonVisible: true,
					buttonText: SCREEN_TEXT.buttonStart
				}
			}
		];

		statusTests.forEach(test => {
			runStatusTest(test.description, test.config, test.expected);
		});
	});

	describe('summary', () => {
		it('renders summary with amount, block number and formatted date', async () => {
			// Arrange:
			setupMocks({
				statusResponse: harvestingStatusActive,
				summaryResponse: harvestingSummaryWithData
			});

			// Act:
			const screenTester = new ScreenTester(Harvesting);
			await screenTester.waitForTimer(); // init
			await screenTester.waitForTimer(); // fetch data
			await screenTester.waitForTimer(); // process results

			// Assert:
			screenTester.expectText([
				SCREEN_TEXT.textSummaryTitle,
				SCREEN_TEXT.textSummaryBlockLabel,
				SCREEN_TEXT.textSummary30DaysLabel,
				SUMMARY_BLOCK_NUMBER_TEXT,
				SCREEN_TEXT.textSummaryBlocksCount,
				SUMMARY_LATEST_DATE_TEXT
			]);
			// Amount components split integer and decimal parts
			screenTester.expectText(['+ 12', '.5', '+ 150', '.75'], true);
		});

		it('renders summary with placeholder when no harvesting data exists', async () => {
			// Arrange:
			setupMocks({
				statusResponse: harvestingStatusInactive,
				summaryResponse: harvestingSummaryEmpty
			});

			// Act:
			const screenTester = new ScreenTester(Harvesting);
			await screenTester.waitForTimer(); // init
			await screenTester.waitForTimer(); // fetch data

			// Assert:
			screenTester.expectText([
				SCREEN_TEXT.textSummaryTitle,
				SCREEN_TEXT.textSummaryBlockLabel,
				SCREEN_TEXT.textSummary30DaysLabel,
				'-' // placeholder for empty block number
			]);
		});
	});

	describe('send transaction', () => {
		const runSendTransactionTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const { walletControllerMock } = setupMocks({
					accountInfo: config.accountInfo,
					statusResponse: config.statusResponse
				});
				mockRouter({ goToHome: jest.fn() });
				mockPasscode();

				// Act:
				const screenTester = new ScreenTester(Harvesting);
				await screenTester.waitForTimer(); // fetch status
				await screenTester.waitForTimer(); // fetch fees
				await screenTester.waitForTimer(); // debounce

				screenTester.pressButton(config.buttonTextToPress);
				await screenTester.waitForTimer(); // dialog
				screenTester.pressButton(SCREEN_TEXT.buttonConfirm);
				await screenTester.waitForTimer(); // passcode
				await screenTester.waitForTimer(); // sign
				await screenTester.waitForTimer(); // announce

				// Assert:
				expect(walletControllerMock.modules.harvesting[expected.createMethod]).toHaveBeenCalled();
				expect(walletControllerMock.signTransactionBundle).toHaveBeenCalledWith(transactionBundle);
				expect(walletControllerMock.announceSignedTransactionBundle).toHaveBeenCalledWith(signedTransactionBundle);
			});
		};

		const sendTransactionTests = [
			{
				description: 'sends start harvesting transaction when pressing start button',
				config: {
					accountInfo: accountInfoNoKeys,
					statusResponse: harvestingStatusInactive,
					buttonTextToPress: SCREEN_TEXT.buttonStart
				},
				expected: {
					createMethod: 'createStartHarvestingTransaction'
				}
			},
			{
				description: 'sends stop harvesting transaction when pressing stop button',
				config: {
					accountInfo: accountInfoEligible,
					statusResponse: harvestingStatusActive,
					buttonTextToPress: SCREEN_TEXT.buttonStop
				},
				expected: {
					createMethod: 'createStopHarvestingTransaction'
				}
			}
		];

		sendTransactionTests.forEach(test => {
			runSendTransactionTest(test.description, test.config, test.expected);
		});
	});

	describe('multisig sender integration', () => {
		// The current account harvests, the multisig account does not. Their data must never be mixed up
		const MULTISIG_SENDER_CONFIG = {
			accountInfo: accountInfoEligible,
			statusResponse: harvestingStatusActive,
			summaryResponse: harvestingSummaryWithData,
			multisigStatusResponse: harvestingStatusInactive,
			multisigSummaryResponse: harvestingSummaryMultisig,
			multisigAccounts: [multisigAccountInfo]
		};

		const createDeferred = () => {
			let resolveDeferred;
			const promise = new Promise(resolve => {
				resolveDeferred = resolve;
			});

			return { promise, resolve: resolveDeferred };
		};

		const pressMultisigSender = async screenTester => {
			screenTester.pressButton(SCREEN_TEXT.senderTabMultisigAccount); // opens the dropdown
			await screenTester.waitForTimer();
			screenTester.pressButton(multisigAccountInfo.address); // selects the multisig account
		};

		const selectMultisigSender = async screenTester => {
			await pressMultisigSender(screenTester);
			await screenTester.waitForTimer(); // fetch status and summary of the multisig account
			await screenTester.waitForTimer(); // recompute fees
		};

		it('fetches status and summary for the selected multisig account', async () => {
			// Arrange:
			const { walletControllerMock } = setupMocks(MULTISIG_SENDER_CONFIG);

			// Act:
			const screenTester = new ScreenTester(Harvesting);
			await screenTester.waitForTimer(); // initial load
			await selectMultisigSender(screenTester);

			// Assert:
			const { harvesting } = walletControllerMock.modules;
			expect(harvesting.fetchStatus).toHaveBeenCalledWith(expect.objectContaining({ address: multisigAccountInfo.address }));
			expect(harvesting.fetchSummary).toHaveBeenCalledWith(multisigAccountInfo.address);
			screenTester.expectText([SCREEN_TEXT.textStatusInactive, SUMMARY_MULTISIG_BLOCK_NUMBER_TEXT]);
		});

		it('does not show the status and summary of the current account while the multisig account is loading', async () => {
			// Arrange:
			setupMocks(MULTISIG_SENDER_CONFIG);
			const screenTester = new ScreenTester(Harvesting);
			await screenTester.waitForTimer(); // initial load
			await screenTester.waitForTimer(); // fetch status and summary of the current account
			screenTester.expectText([SCREEN_TEXT.textStatusActive, SUMMARY_BLOCK_NUMBER_TEXT]);

			// Act: select the multisig account, without letting its data load
			await pressMultisigSender(screenTester);

			// Assert:
			screenTester.notExpectText([SCREEN_TEXT.textStatusActive, SUMMARY_BLOCK_NUMBER_TEXT]);
			screenTester.expectText([SCREEN_TEXT.textStatusUnknown]);
		});

		it('keeps the status and summary of the selected multisig account when a transaction is confirmed', async () => {
			// Arrange:
			const { walletControllerMock } = setupMocks(MULTISIG_SENDER_CONFIG);
			const { harvesting } = walletControllerMock.modules;
			const screenTester = new ScreenTester(Harvesting);
			await screenTester.waitForTimer(); // initial load
			await selectMultisigSender(screenTester);
			harvesting.fetchStatus.mockClear();
			harvesting.fetchSummary.mockClear();

			// Act: a confirmed transaction schedules a refresh of the data of the screen
			await act(async () => {
				walletControllerMock.emit(ControllerEventName.NEW_TRANSACTION_CONFIRMED);
			});
			await screenTester.waitForTimer(); // scheduled refresh
			await screenTester.waitForTimer(); // fetch status and summary

			// Assert: the refresh loads the selected multisig account, and not the account the screen was mounted with
			expect(harvesting.fetchStatus).toHaveBeenCalledWith(expect.objectContaining({ address: multisigAccountInfo.address }));
			expect(harvesting.fetchStatus).not.toHaveBeenCalledWith(expect.objectContaining({ address: currentAccount.address }));
			expect(harvesting.fetchSummary).toHaveBeenCalledWith(multisigAccountInfo.address);
			expect(harvesting.fetchSummary).not.toHaveBeenCalledWith(currentAccount.address);
			screenTester.expectText([SCREEN_TEXT.textStatusInactive, SUMMARY_MULTISIG_BLOCK_NUMBER_TEXT]);
			screenTester.notExpectText([SCREEN_TEXT.textStatusActive, SUMMARY_BLOCK_NUMBER_TEXT]);
		});

		it('ignores the response of the current account which arrives after the multisig account is selected', async () => {
			// Arrange: hold the status of the current account, so that it resolves after the sender is switched
			const { walletControllerMock } = setupMocks(MULTISIG_SENDER_CONFIG);
			const { harvesting } = walletControllerMock.modules;
			const currentAccountStatusFetch = createDeferred();
			const fetchStatus = harvesting.fetchStatus.getMockImplementation();
			harvesting.fetchStatus.mockImplementation(async account => {
				if (account.address === currentAccount.address)
					await currentAccountStatusFetch.promise;

				return fetchStatus(account);
			});

			const screenTester = new ScreenTester(Harvesting);
			await screenTester.waitForTimer(); // initial load, the status of the current account stays pending
			await selectMultisigSender(screenTester);
			screenTester.expectText([SCREEN_TEXT.textStatusInactive, SUMMARY_MULTISIG_BLOCK_NUMBER_TEXT]);

			// Act:
			await act(async () => {
				currentAccountStatusFetch.resolve();
			});
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textStatusInactive, SUMMARY_MULTISIG_BLOCK_NUMBER_TEXT]);
			screenTester.notExpectText([SCREEN_TEXT.textStatusActive]);
		});

		it('sends start harvesting transaction with the selected multisig account as harvester', async () => {
			// Arrange:
			const { walletControllerMock } = setupMocks({
				...MULTISIG_SENDER_CONFIG,
				statusResponse: harvestingStatusInactive,
				summaryResponse: harvestingSummaryEmpty
			});
			mockRouter({ goToHome: jest.fn() });
			mockPasscode();

			// Act:
			const screenTester = new ScreenTester(Harvesting);
			await screenTester.waitForTimer(); // initial load
			await selectMultisigSender(screenTester);

			screenTester.pressButton(SCREEN_TEXT.buttonStart);
			await screenTester.waitForTimer(); // dialog
			screenTester.pressButton(SCREEN_TEXT.buttonConfirm);
			await screenTester.waitForTimer(); // passcode
			await screenTester.waitForTimer(); // sign
			await screenTester.waitForTimer(); // announce

			// Assert:
			const { createStartHarvestingTransaction } = walletControllerMock.modules.harvesting;
			const expectedHarvester = expect.objectContaining({ harvesterAddress: multisigAccountInfo.address });
			expect(createStartHarvestingTransaction).toHaveBeenCalledWith(expectedHarvester);
		});
	});
});
