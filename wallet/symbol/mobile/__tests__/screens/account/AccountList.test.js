import { AccountList } from '@/app/screens/account/AccountList';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockRouter, mockWalletController } from '__tests__/mock-helpers';
import { runScreenNavigationTest } from '__tests__/screen-tests';
import { WalletAccountType } from 'wallet-common-core/src/constants';

// Mocks

jest.mock('@/app/lib/platform/PlatformUtils', () => ({
	PlatformUtils: {
		getOS: jest.fn(() => 'android'),
		vibrate: jest.fn()
	}
}));

jest.mock('@/app/screens/account/hooks', () => ({
	useAccountBalances: jest.fn(() => ({
		accountBalances: {},
		refetch: jest.fn()
	})),
	useAccountMultisigStates: jest.fn(() => ({
		accountMultisigStates: {}
	}))
}));

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER_TESTNET = 'testnet';
const NETWORK_IDENTIFIER_MAINNET = 'mainnet';
const TICKER = 'XYM';

// Screen Text

const SCREEN_TEXT = {
	// Card Titles
	textCardTitleAccount: 'c_accountCard_title_account',
	textCardTitleBalance: 'c_accountCard_title_balance',
	textCardTitleAddress: 'c_accountCard_title_address',

	// Dialog
	dialogRemoveImportedTitle: 's_accountList_confirm_removeImported_title',
	dialogRemoveImportedBody: 's_accountList_confirm_removeImported_body',

	// Button TestIDs
	testIdButtonHide: 'icon-hide',
	testIdButtonDelete: 'icon-delete',

	// Button Labels (accessibility labels for ButtonCircle)
	buttonAddAccountLabel: 'account-add',
	buttonConfirm: 'button_confirm',

	// Icon Labels
	labelLockIcon: 'lock icon'
};

// Account Fixtures

const rootSeedAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER_TESTNET, 0)
	.setAccountType(WalletAccountType.MNEMONIC)
	.build();

const seedAccount1 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER_TESTNET, 1)
	.setAccountType(WalletAccountType.MNEMONIC)
	.build();

const seedAccount2 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER_TESTNET, 2)
	.setAccountType(WalletAccountType.MNEMONIC)
	.build();

const importedAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER_TESTNET, 3)
	.setAccountType(WalletAccountType.EXTERNAL)
	.setName('Imported Account')
	.build();

const mainnetSeedAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER_MAINNET, 0)
	.setAccountType(WalletAccountType.MNEMONIC)
	.setName('Mainnet Root Account')	
	.build();

// Network Properties Fixtures

const networkPropertiesTestnet = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME, NETWORK_IDENTIFIER_TESTNET)
	.build();

// Account Lists

const ACCOUNTS_WITH_MULTIPLE_SEED = [rootSeedAccount, seedAccount1, seedAccount2];
const ACCOUNTS_WITH_IMPORTED = [rootSeedAccount, seedAccount1, importedAccount];
const ACCOUNTS_SINGLE = [rootSeedAccount];

// Account Balances

const MOCK_BALANCES = {
	[rootSeedAccount.publicKey]: { balance: '100', balanceChange: '0' },
	[seedAccount1.publicKey]: { balance: '250', balanceChange: '0' },
	[seedAccount2.publicKey]: { balance: '75', balanceChange: '0' },
	[importedAccount.publicKey]: { balance: '500', balanceChange: '0' }
};

// Account Multisig States

const MULTISIG_STATES_NONE = {
	[rootSeedAccount.publicKey]: false,
	[seedAccount1.publicKey]: false,
	[seedAccount2.publicKey]: false
};
const MULTISIG_STATES_SEED_ACCOUNT_1 = {
	[rootSeedAccount.publicKey]: false,
	[seedAccount1.publicKey]: true,
	[seedAccount2.publicKey]: false
};
const MULTISIG_STATES_SEED_ACCOUNTS_1_AND_2 = {
	[rootSeedAccount.publicKey]: false,
	[seedAccount1.publicKey]: true,
	[seedAccount2.publicKey]: true
};

// Wallet Controller Mock

const mockWalletControllerConfigured = (overrides = {}) => {
	return mockWalletController({
		chainName: CHAIN_NAME,
		ticker: TICKER,
		networkIdentifier: overrides.networkIdentifier ?? NETWORK_IDENTIFIER_TESTNET,
		currentAccount: overrides.currentAccount ?? rootSeedAccount,
		networkProperties: overrides.networkProperties ?? networkPropertiesTestnet,
		accounts: {
			mainnet: overrides.accounts?.mainnet ?? [mainnetSeedAccount],
			testnet: overrides.accounts?.testnet ?? ACCOUNTS_WITH_MULTIPLE_SEED,
			...overrides.accounts
		},
		selectAccount: overrides.selectAccount ?? jest.fn().mockResolvedValue(),
		removeAccount: overrides.removeAccount ?? jest.fn().mockResolvedValue()
	});
};

const mockAccountBalances = (balances = MOCK_BALANCES) => {
	const { useAccountBalances } = require('@/app/screens/account/hooks');
	useAccountBalances.mockReturnValue({
		accountBalances: balances,
		refetch: jest.fn()
	});
};

const mockAccountMultisigStates = (multisigStates = MULTISIG_STATES_NONE) => {
	const { useAccountMultisigStates } = require('@/app/screens/account/hooks');
	useAccountMultisigStates.mockReturnValue({
		accountMultisigStates: multisigStates
	});
};

describe('screens/account/AccountList', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		mockLocalization();
		mockRouter();
		mockAccountBalances();
		mockAccountMultisigStates();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('render', () => {
		it('renders all accounts for the current network', () => {
			// Arrange:
			mockWalletControllerConfigured();
			const expectedTexts = [
				rootSeedAccount.name,
				rootSeedAccount.address,
				seedAccount1.name,
				seedAccount1.address,
				seedAccount2.name,
				seedAccount2.address
			];

			// Act:
			const screenTester = new ScreenTester(AccountList);

			// Assert:
			screenTester.expectText(expectedTexts);
		});

		it('does not render accounts from other networks', () => {
			// Arrange:
			mockWalletControllerConfigured();
			const notExpectedTexts = [
				mainnetSeedAccount.name,
				mainnetSeedAccount.address
			];

			// Act:
			const screenTester = new ScreenTester(AccountList);

			// Assert:
			screenTester.notExpectText(notExpectedTexts);
		});

		it('renders account card field titles', () => {
			// Arrange:
			mockWalletControllerConfigured();
			const expectedTexts = [
				SCREEN_TEXT.textCardTitleAccount,
				SCREEN_TEXT.textCardTitleBalance,
				SCREEN_TEXT.textCardTitleAddress
			];

			// Act:
			const screenTester = new ScreenTester(AccountList);

			// Assert:
			screenTester.expectText(expectedTexts, true);
		});

		it('renders add account floating button', () => {
			// Arrange:
			mockWalletControllerConfigured();

			// Act:
			const screenTester = new ScreenTester(AccountList);

			// Assert:
			screenTester.expectElement(SCREEN_TEXT.buttonAddAccountLabel, 'label');
		});

		describe('account balances', () => {
			const runBalanceDisplayTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					mockWalletControllerConfigured({
						accounts: { testnet: [rootSeedAccount] }
					});
					mockAccountBalances({
						[rootSeedAccount.publicKey]: config.balanceInfo
					});

					// Act:
					const screenTester = new ScreenTester(AccountList);

					// Assert:
					screenTester.expectText(expected.expectedTexts);
				});
			};

			const balanceDisplayTests = [
				{
					description: 'displays account balance',
					config: {
						balanceInfo: { balance: '100', balanceChange: '0' }
					},
					expected: {
						expectedTexts: ['100']
					}
				},
				{
					description: 'displays positive balance change',
					config: {
						balanceInfo: { balance: '250', balanceChange: '5' }
					},
					expected: {
						expectedTexts: ['250', `+5 ${TICKER}`]
					}
				},
				{
					description: 'displays negative balance change',
					config: {
						balanceInfo: { balance: '75', balanceChange: '-10' }
					},
					expected: {
						expectedTexts: ['75', `-10 ${TICKER}`]
					}
				}
			];

			balanceDisplayTests.forEach(test => {
				runBalanceDisplayTest(test.description, test.config, test.expected);
			});
		});

		describe('multisig accounts', () => {
			const runMultisigCardTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					mockWalletControllerConfigured({
						currentAccount: config.currentAccount,
						accounts: { testnet: ACCOUNTS_WITH_MULTIPLE_SEED }
					});
					mockAccountMultisigStates(config.multisigStates);

					// Act:
					const screenTester = new ScreenTester(AccountList);

					// Assert:
					screenTester.expectElementCount(SCREEN_TEXT.labelLockIcon, expected.lockIconCount, 'label');
				});
			};

			const multisigCardTests = [
				{
					description: 'renders lock icon for multisig account',
					config: {
						currentAccount: rootSeedAccount,
						multisigStates: MULTISIG_STATES_SEED_ACCOUNT_1
					},
					expected: { lockIconCount: 1 }
				},
				{
					description: 'renders lock icon for each multisig account',
					config: {
						currentAccount: rootSeedAccount,
						multisigStates: MULTISIG_STATES_SEED_ACCOUNTS_1_AND_2
					},
					expected: { lockIconCount: 2 }
				},
				{
					description: 'renders lock icon for selected multisig account',
					config: {
						currentAccount: seedAccount1,
						multisigStates: MULTISIG_STATES_SEED_ACCOUNT_1
					},
					expected: { lockIconCount: 1 }
				},
				{
					description: 'does not render lock icon for regular accounts',
					config: {
						currentAccount: rootSeedAccount,
						multisigStates: MULTISIG_STATES_NONE
					},
					expected: { lockIconCount: 0 }
				}
			];

			multisigCardTests.forEach(test => {
				runMultisigCardTest(test.description, test.config, test.expected);
			});

			it('resolves multisig states with the wallet controller', () => {
				// Arrange:
				const { useAccountMultisigStates } = require('@/app/screens/account/hooks');
				const walletControllerMock = mockWalletControllerConfigured();

				// Act:
				new ScreenTester(AccountList);

				// Assert:
				expect(useAccountMultisigStates).toHaveBeenCalledWith(walletControllerMock);
			});
		});
	});

	describe('account selection', () => {
		it('selects account and navigates back when account card is pressed', async () => {
			// Arrange:
			const selectAccountMock = jest.fn().mockResolvedValue();
			const routerMock = mockRouter();
			mockWalletControllerConfigured({
				selectAccount: selectAccountMock,
				currentAccount: rootSeedAccount,
				accounts: { testnet: ACCOUNTS_WITH_MULTIPLE_SEED }
			});
			const screenTester = new ScreenTester(AccountList);

			// Act:
			screenTester.pressButton(seedAccount1.name);
			await screenTester.waitForTimer();

			// Assert:
			expect(selectAccountMock).toHaveBeenCalledWith(seedAccount1.publicKey);
			expect(routerMock.goBack).toHaveBeenCalled();
		});
	});

	describe('account removal', () => {
		describe('seed account removal', () => {
			it('hides seed account directly without confirmation dialog', async () => {
				// Arrange:
				const removeAccountMock = jest.fn().mockResolvedValue(undefined);
				mockWalletControllerConfigured({
					removeAccount: removeAccountMock,
					accounts: { testnet: ACCOUNTS_WITH_MULTIPLE_SEED }
				});
				const screenTester = new ScreenTester(AccountList);

				// Act:
				screenTester.pressButtonByTestId(SCREEN_TEXT.testIdButtonHide, 0);
				await screenTester.waitForTimer();

				// Assert:
				expect(removeAccountMock).toHaveBeenCalledWith({
					publicKey: seedAccount1.publicKey,
					networkIdentifier: NETWORK_IDENTIFIER_TESTNET
				});
			});

			it('does not show remove button for root account', () => {
				// Arrange:
				mockWalletControllerConfigured({
					accounts: { testnet: ACCOUNTS_SINGLE }
				});

				// Act:
				const screenTester = new ScreenTester(AccountList);

				// Assert:
				screenTester.notExpectElement(SCREEN_TEXT.testIdButtonHide);
				screenTester.notExpectElement(SCREEN_TEXT.testIdButtonDelete);
			});
		});

		describe('imported account removal', () => {
			it('shows confirmation dialog when removing imported account', async () => {
				// Arrange:
				mockWalletControllerConfigured({
					accounts: { testnet: ACCOUNTS_WITH_IMPORTED }
				});
				const screenTester = new ScreenTester(AccountList);

				// Act:
				screenTester.pressButtonByTestId(SCREEN_TEXT.testIdButtonDelete);
				await screenTester.waitForTimer();

				// Assert:
				screenTester.expectText([
					SCREEN_TEXT.dialogRemoveImportedTitle,
					SCREEN_TEXT.dialogRemoveImportedBody
				]);
			});

			it('removes imported account after confirmation', async () => {
				// Arrange:
				const removeAccountMock = jest.fn().mockResolvedValue();
				mockWalletControllerConfigured({
					removeAccount: removeAccountMock,
					accounts: { testnet: ACCOUNTS_WITH_IMPORTED }
				});
				const screenTester = new ScreenTester(AccountList);

				// Act:
				screenTester.pressButtonByTestId(SCREEN_TEXT.testIdButtonDelete);
				await screenTester.waitForTimer();
				screenTester.pressButton(SCREEN_TEXT.buttonConfirm);
				await screenTester.waitForTimer();

				// Assert:
				expect(removeAccountMock).toHaveBeenCalledWith({
					publicKey: importedAccount.publicKey,
					networkIdentifier: NETWORK_IDENTIFIER_TESTNET
				});
			});
		});

		describe('removing currently selected account', () => {
			it('selects root account before removing currently selected account', async () => {
				// Arrange:
				const selectAccountMock = jest.fn().mockResolvedValue();
				const removeAccountMock = jest.fn().mockResolvedValue();
				mockWalletControllerConfigured({
					currentAccount: seedAccount1,
					selectAccount: selectAccountMock,
					removeAccount: removeAccountMock,
					accounts: { testnet: ACCOUNTS_WITH_MULTIPLE_SEED }
				});
				const screenTester = new ScreenTester(AccountList);

				// Act:
				screenTester.pressButtonByTestId(SCREEN_TEXT.testIdButtonHide, 0);
				await screenTester.waitForTimer();

				// Assert:
				expect(selectAccountMock).toHaveBeenCalledWith(rootSeedAccount.publicKey);
				expect(removeAccountMock).toHaveBeenCalledWith({
					publicKey: seedAccount1.publicKey,
					networkIdentifier: NETWORK_IDENTIFIER_TESTNET
				});
			});
		});
	});

	runScreenNavigationTest(AccountList, {
		navigationActions: [
			{
				buttonLabel: SCREEN_TEXT.buttonAddAccountLabel,
				actionName: 'goToAddSeedAccount'
			}
		]
	});
});
