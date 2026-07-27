import { HarvestingStatus } from '@/app/screens/harvesting/types/Harvesting';
import { createHarvestingStatusViewModel, getHarvestingEligibility } from '@/app/screens/harvesting/utils/harvesting-status';
import { AccountInfoFixtureBuilder } from '__fixtures__/local/AccountInfoFixtureBuilder';
import { mockLocalization } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const DIVISIBILITY = 6;
const NODE_URL = 'https://harvest-node.symbol.network:3001';

// The minimum balance an account must hold to be eligible for harvesting
const MIN_BALANCE = '10000';
const BELOW_MIN_BALANCE = '9999';
const ABOVE_MIN_BALANCE = '50000';

// Screen Text

const SCREEN_TEXT = {
	textStatusActive: 's_harvesting_status_active',
	textStatusPending: 's_harvesting_status_pending',
	textStatusInactive: 's_harvesting_status_inactive',
	textStatusOperator: 's_harvesting_status_operator',
	textStatusUnknown: 's_harvesting_status_unknown',

	textWarningBalance: 's_harvesting_warning_balance',
	textWarningImportance: 's_harvesting_warning_importance',
	textWarningNodeDown: 's_harvesting_warning_node_down'
};

// Account Info Fixtures

const createAccountInfo = (balance, importance) => AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setBalance(balance)
	.setImportance(importance)
	.build();

const accountInfoEligible = createAccountInfo(ABOVE_MIN_BALANCE, 100);
const accountInfoAtMinBalance = createAccountInfo(MIN_BALANCE, 100);
const accountInfoLowBalance = createAccountInfo(BELOW_MIN_BALANCE, 100);
const accountInfoLowImportance = createAccountInfo(ABOVE_MIN_BALANCE, 0);
const accountInfoLowBalanceAndImportance = createAccountInfo(BELOW_MIN_BALANCE, 0);

// Eligibility Fixtures

const eligibilityMet = { isBalanceSufficient: true, isImportanceSufficient: true, isEligible: true };
const eligibilityLowBalance = { isBalanceSufficient: false, isImportanceSufficient: true, isEligible: false };
const eligibilityLowImportance = { isBalanceSufficient: true, isImportanceSufficient: false, isEligible: false };
const eligibilityLowBalanceAndImportance = { isBalanceSufficient: false, isImportanceSufficient: false, isEligible: false };

// Harvesting Status Fixtures

const harvestingStatusActive = { status: HarvestingStatus.ACTIVE, nodeUrl: NODE_URL };
const harvestingStatusPending = { status: HarvestingStatus.PENDING, nodeUrl: NODE_URL };
const harvestingStatusOperator = { status: HarvestingStatus.OPERATOR, nodeUrl: NODE_URL };
const harvestingStatusInactive = { status: HarvestingStatus.INACTIVE };
const harvestingStatusNodeUnknown = { status: HarvestingStatus.NODE_UNKNOWN };

describe('screens/harvesting/utils/harvesting-status', () => {
	beforeEach(() => {
		mockLocalization();
	});

	describe('getHarvestingEligibility', () => {
		const runEligibilityTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = getHarvestingEligibility(config.accountInfo, DIVISIBILITY);

				// Assert:
				expect(result).toEqual(expected.eligibility);
			});
		};

		const eligibilityTests = [
			{
				description: 'returns eligible when balance and importance meet the requirements',
				config: { accountInfo: accountInfoEligible },
				expected: { eligibility: eligibilityMet }
			},
			{
				description: 'returns eligible when balance is exactly the required minimum',
				config: { accountInfo: accountInfoAtMinBalance },
				expected: { eligibility: eligibilityMet }
			},
			{
				description: 'returns insufficient balance when balance is below the required minimum',
				config: { accountInfo: accountInfoLowBalance },
				expected: { eligibility: eligibilityLowBalance }
			},
			{
				description: 'returns insufficient importance when importance is zero',
				config: { accountInfo: accountInfoLowImportance },
				expected: { eligibility: eligibilityLowImportance }
			},
			{
				description: 'returns both requirements unmet when balance and importance are too low',
				config: { accountInfo: accountInfoLowBalanceAndImportance },
				expected: { eligibility: eligibilityLowBalanceAndImportance }
			},
			{
				description: 'returns not eligible when the account info is not resolved yet',
				config: { accountInfo: undefined },
				expected: { eligibility: eligibilityLowBalanceAndImportance }
			}
		];

		eligibilityTests.forEach(test => {
			runEligibilityTest(test.description, test.config, test.expected);
		});
	});

	describe('createHarvestingStatusViewModel', () => {
		describe('status display', () => {
			const runStatusDisplayTest = (description, config, expected) => {
				it(description, () => {
					// Act:
					const result = createHarvestingStatusViewModel({
						harvestingStatus: config.harvestingStatus,
						eligibility: eligibilityMet
					});

					// Assert:
					expect(result.statusDisplay.statusText).toBe(expected.statusText);
					expect(result.nodeUrl).toBe(expected.nodeUrl);
				});
			};

			const statusDisplayTests = [
				{
					description: 'renders active status with the harvesting node url',
					config: { harvestingStatus: harvestingStatusActive },
					expected: { statusText: SCREEN_TEXT.textStatusActive, nodeUrl: NODE_URL }
				},
				{
					description: 'renders pending status with the harvesting node url',
					config: { harvestingStatus: harvestingStatusPending },
					expected: { statusText: SCREEN_TEXT.textStatusPending, nodeUrl: NODE_URL }
				},
				{
					description: 'renders operator status with the harvesting node url',
					config: { harvestingStatus: harvestingStatusOperator },
					expected: { statusText: SCREEN_TEXT.textStatusOperator, nodeUrl: NODE_URL }
				},
				{
					description: 'renders inactive status without a node url',
					config: { harvestingStatus: harvestingStatusInactive },
					expected: { statusText: SCREEN_TEXT.textStatusInactive, nodeUrl: null }
				},
				{
					description: 'renders unknown status when the node is not reachable',
					config: { harvestingStatus: harvestingStatusNodeUnknown },
					expected: { statusText: SCREEN_TEXT.textStatusUnknown, nodeUrl: null }
				},
				{
					description: 'renders unknown status when the status is not loaded yet',
					config: { harvestingStatus: null },
					expected: { statusText: SCREEN_TEXT.textStatusUnknown, nodeUrl: null }
				},
				{
					description: 'renders unknown status when the status is not recognized',
					config: { harvestingStatus: { status: 'unrecognized' } },
					expected: { statusText: SCREEN_TEXT.textStatusUnknown, nodeUrl: null }
				}
			];

			statusDisplayTests.forEach(test => {
				runStatusDisplayTest(test.description, test.config, test.expected);
			});
		});

		describe('warning', () => {
			const runWarningTest = (description, config, expected) => {
				it(description, () => {
					// Act:
					const result = createHarvestingStatusViewModel({
						harvestingStatus: config.harvestingStatus,
						eligibility: config.eligibility
					});

					// Assert:
					expect(result.warning.isVisible).toBe(expected.isVisible);
					expect(result.warning.text).toBe(expected.text);
				});
			};

			const warningTests = [
				{
					description: 'warns about the node being down when the node is not reachable',
					config: { harvestingStatus: harvestingStatusNodeUnknown, eligibility: eligibilityMet },
					expected: { isVisible: true, text: SCREEN_TEXT.textWarningNodeDown }
				},
				{
					description: 'warns about the balance when the account cannot start harvesting',
					config: { harvestingStatus: harvestingStatusInactive, eligibility: eligibilityLowBalance },
					expected: { isVisible: true, text: SCREEN_TEXT.textWarningBalance }
				},
				{
					description: 'warns about the importance when the account cannot start harvesting',
					config: { harvestingStatus: harvestingStatusInactive, eligibility: eligibilityLowImportance },
					expected: { isVisible: true, text: SCREEN_TEXT.textWarningImportance }
				},
				{
					description: 'warns about the balance first when both requirements are unmet',
					config: { harvestingStatus: harvestingStatusInactive, eligibility: eligibilityLowBalanceAndImportance },
					expected: { isVisible: true, text: SCREEN_TEXT.textWarningBalance }
				},
				{
					description: 'does not warn when the account is inactive but eligible',
					config: { harvestingStatus: harvestingStatusInactive, eligibility: eligibilityMet },
					expected: { isVisible: false, text: undefined }
				},
				{
					description: 'does not warn about the balance while the account is already harvesting',
					config: { harvestingStatus: harvestingStatusActive, eligibility: eligibilityLowBalance },
					expected: { isVisible: false, text: undefined }
				},
				{
					description: 'does not warn about the balance while harvesting is pending',
					config: { harvestingStatus: harvestingStatusPending, eligibility: eligibilityLowBalance },
					expected: { isVisible: false, text: undefined }
				},
				{
					description: 'does not warn about the balance while the account is a node operator',
					config: { harvestingStatus: harvestingStatusOperator, eligibility: eligibilityLowBalance },
					expected: { isVisible: false, text: undefined }
				},
				{
					description: 'does not warn when the status is not loaded yet',
					config: { harvestingStatus: null, eligibility: eligibilityLowBalance },
					expected: { isVisible: false, text: undefined }
				}
			];

			warningTests.forEach(test => {
				runWarningTest(test.description, test.config, test.expected);
			});
		});

		it('renders pending status without a warning while a transaction is being confirmed', () => {
			// Act:
			const result = createHarvestingStatusViewModel({
				harvestingStatus: harvestingStatusActive,
				eligibility: eligibilityLowBalance,
				isPendingTransaction: true
			});

			// Assert:
			expect(result.statusDisplay.statusText).toBe(SCREEN_TEXT.textStatusPending);
			expect(result.warning.isVisible).toBe(false);
			expect(result.nodeUrl).toBe(null);
		});
	});
});
