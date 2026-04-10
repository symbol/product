import { Harvesting } from '@/app/screens/harvesting/Harvesting';
import { formatDate } from '@/app/utils';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AccountInfoFixtureBuilder } from '__fixtures__/local/AccountInfoFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { TransactionFeeFixtureBuilder } from '__fixtures__/local/TransactionFeeFixtureBuilder';
import { TransactionFixtureBuilder } from '__fixtures__/local/TransactionFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { createWalletControllerMock, mockLocalization, mockPasscode, mockRouter, mockWalletController } from '__tests__/mock-helpers';
import { TransactionBundle } from 'wallet-common-core';
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

// Harvesting Status Enum

const { HarvestingStatus } = constants;

// Screen Text

const SCREEN_TEXT = {
	// Screen titles
	textScreenTitle: 's_harvesting_title',
	textScreenDescription: 's_harvesting_description',

	// Status section
	textStatusTitle: 'fieldTitle_status',
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

	// Buttons
	buttonStart: 'button_start',
	buttonStop: 'button_stop',
	buttonConfirm: 'button_confirm'
};

// Account Fixtures

const currentAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
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

const harvestingSummaryEmpty = null;

const harvestingSummaryWithData = {
	latestAmount: SUMMARY_LATEST_AMOUNT,
	latestHeight: SUMMARY_LATEST_HEIGHT,
	latestDate: SUMMARY_LATEST_DATE,
	amountPer30Days: SUMMARY_AMOUNT_30_DAYS,
	blocksHarvestedPer30Days: SUMMARY_BLOCKS_30_DAYS
};

// Harvesting Module Mock Factory

const createHarvestingModuleMock = (overrides = {}) => ({
	fetchStatus: jest.fn().mockResolvedValue(overrides.statusResponse ?? harvestingStatusInactive),
	fetchSummary: jest.fn().mockResolvedValue(overrides.summaryResponse ?? harvestingSummaryEmpty),
	fetchNodeList: jest.fn().mockResolvedValue(overrides.nodeList ?? [NODE_URL]),
	createStartHarvestingTransaction: jest.fn().mockReturnValue(transactionBundle),
	createStopHarvestingTransaction: jest.fn().mockReturnValue(transactionBundle)
});

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

// Setup

const setupMocks = (config = {}) => {
	const {
		accountInfo = accountInfoEligible,
		statusResponse = harvestingStatusInactive,
		summaryResponse = harvestingSummaryEmpty,
		nodeList = [NODE_URL]
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
			harvesting: createHarvestingModuleMock({ statusResponse, summaryResponse, nodeList }),
			transfer: createTransferModuleMock()
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
			const expectedBlockNumber = `#${SUMMARY_LATEST_HEIGHT}`;

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
				expectedBlockNumber,
				SCREEN_TEXT.textSummaryBlocksCount,
				SUMMARY_LATEST_DATE_TEXT
			]);
			// Amount components split integer and decimal parts
			screenTester.expectText(['12', '.5', '150', '.75'], true);
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
});
