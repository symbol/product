import { AddSeedAccount } from '@/app/screens/account/AddSeedAccount';
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
	useSeedAccountBalances: jest.fn(() => ({
		accountBalances: {},
		refetch: jest.fn()
	}))
}));

// Constants

const CHAIN_NAME = 'symbol';
const CURRENT_NETWORK_IDENTIFIER = 'testnet';
const TICKER = 'XYM';
const VALID_ACCOUNT_NAME = 'My Account';
const LONG_ACCOUNT_NAME = 'This name is way too long for validation';

// Screen Text

const SCREEN_TEXT = {
	// Titles & Labels
	textNameTitle: 's_addAccount_name_title',
	textSelectTitle: 's_addAccount_select_title',
	textDescription: 's_addAccount_seed_description',
	inputNameLabel: 's_addAccount_name_input',

	// Account Card
	textCardTitleAccount: 'c_accountCard_title_account',
	textCardTitleBalance: 'c_accountCard_title_balance',
	textCardTitleAddress: 'c_accountCard_title_address',

	// Buttons
	buttonAddExternalAccount: 'button_addExternalAccount',

	// Default Account Names (with index placeholder)
	textDefaultAccountName: 's_addAccount_seed_name_default',

	// Validation Errors
	textValidationNameTooLong: 'validation_error_account_name_long'
};


// Seed Account Fixtures

const seedAccount0 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, CURRENT_NETWORK_IDENTIFIER, 0)
	.setAccountType(WalletAccountType.MNEMONIC)
	.data;

const seedAccount1 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, CURRENT_NETWORK_IDENTIFIER, 1)
	.setAccountType(WalletAccountType.MNEMONIC)
	.data;

const seedAccount2 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, CURRENT_NETWORK_IDENTIFIER, 2)
	.setAccountType(WalletAccountType.MNEMONIC)
	.data;

const seedAccount3 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, CURRENT_NETWORK_IDENTIFIER, 3)
	.setAccountType(WalletAccountType.MNEMONIC)
	.data;

const seedAccount4 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, CURRENT_NETWORK_IDENTIFIER, 4)
	.setAccountType(WalletAccountType.MNEMONIC)
	.data;

// Network Properties Fixtures

const networkPropertiesTestnet = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME, CURRENT_NETWORK_IDENTIFIER)
	.data;

// Seed Address Lists

const ALL_SEED_ACCOUNTS = [seedAccount0, seedAccount1, seedAccount2, seedAccount3, seedAccount4];
const ALREADY_ADDED_SEED_ACCOUNTS = [seedAccount0, seedAccount1];

// Account Balances

const MOCK_SEED_BALANCES = {
	[seedAccount2.publicKey]: { balance: '100', isLoading: false },
	[seedAccount3.publicKey]: { balance: '250', isLoading: false },
	[seedAccount4.publicKey]: { balance: '0', isLoading: false }
};

// Wallet Controller Mock

const mockWalletControllerConfigured = (overrides = {}) => {
	return mockWalletController({
		chainName: CHAIN_NAME,
		ticker: TICKER,
		networkProperties: networkPropertiesTestnet,
		networkIdentifier: CURRENT_NETWORK_IDENTIFIER,
		accounts: {
			mainnet: [],
			testnet: ALREADY_ADDED_SEED_ACCOUNTS
		},
		seedAddresses: {
			mainnet: [],
			testnet: ALL_SEED_ACCOUNTS
		},
		networkApi: {
			account: {
				fetchAccountBalance: jest.fn().mockResolvedValue('0')
			}
		},
		addSeedAccount: overrides.addSeedAccount ?? jest.fn().mockResolvedValue()
	});
};

const mockSeedAccountBalances = (balances = MOCK_SEED_BALANCES) => {
	const { useSeedAccountBalances } = require('@/app/screens/account/hooks');
	useSeedAccountBalances.mockReturnValue({
		accountBalances: balances,
		refetch: jest.fn()
	});
};

describe('screens/account/AddSeedAccount', () => {
	beforeEach(() => {
		mockLocalization();
		mockRouter();
		mockSeedAccountBalances();
		jest.clearAllMocks();
	});

	describe('render', () => {
		it('renders screen with name input and account selection', () => {
			// Arrange:
			mockWalletControllerConfigured();
			const expectedTexts = [
				SCREEN_TEXT.textNameTitle,
				SCREEN_TEXT.textSelectTitle,
				SCREEN_TEXT.textDescription,
				SCREEN_TEXT.buttonAddExternalAccount
			];

			// Act:
			const screenTester = new ScreenTester(AddSeedAccount);

			// Assert:
			screenTester.expectText(expectedTexts);
		});

		it('renders available seed accounts that are not already added', () => {
			// Arrange:
			mockWalletControllerConfigured();
			const expectedAddresses = [
				seedAccount2.address,
				seedAccount3.address,
				seedAccount4.address
			];
			const notExpectedAddresses = [
				seedAccount0.address,
				seedAccount1.address
			];

			// Act:
			const screenTester = new ScreenTester(AddSeedAccount);

			// Assert:
			screenTester.expectText(expectedAddresses);
			screenTester.notExpectText(notExpectedAddresses);
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
			const screenTester = new ScreenTester(AddSeedAccount);

			// Assert:
			screenTester.expectText(expectedTexts, true);
		});

		describe('account balances display', () => {
			it('displays account balances when loaded', () => {
				// Arrange:
				mockWalletControllerConfigured();
				mockSeedAccountBalances();

				// Act:
				const screenTester = new ScreenTester(AddSeedAccount);

				// Assert:
				screenTester.expectText(['100', '250']);
			});
		});
	});

	describe('account name input', () => {
		it('allows entering a custom account name', () => {
			// Arrange:
			mockWalletControllerConfigured();
			const screenTester = new ScreenTester(AddSeedAccount);

			// Act:
			screenTester.inputText(SCREEN_TEXT.inputNameLabel, VALID_ACCOUNT_NAME);

			// Assert:
			screenTester.expectInputValue(VALID_ACCOUNT_NAME);
		});

		describe('name validation', () => {
			const runNameValidationTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					mockWalletControllerConfigured();
					const screenTester = new ScreenTester(AddSeedAccount);

					// Act:
					screenTester.inputText(SCREEN_TEXT.inputNameLabel, config.name);

					// Assert:
					if (expected.shouldThrowError)
						screenTester.expectText([SCREEN_TEXT.textValidationNameTooLong]);
					else
						screenTester.notExpectText([SCREEN_TEXT.textValidationNameTooLong]);
				});
			};

			const nameValidationTests = [
				{
					description: 'shows no error for valid account name',
					config: { name: VALID_ACCOUNT_NAME },
					expected: { shouldThrowError: false }
				},
				{
					description: 'shows error when account name is too long',
					config: { name: LONG_ACCOUNT_NAME },
					expected: { shouldThrowError: true }
				},
				{
					description: 'shows no error for empty name (uses default)',
					config: { name: '' },
					expected: { shouldThrowError: false }
				}
			];

			nameValidationTests.forEach(test => {
				runNameValidationTest(test.description, test.config, test.expected);
			});
		});
	});

	describe('account selection', () => {
		const runAccountSelectionTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const addSeedAccountMock = jest.fn().mockResolvedValue(undefined);
				const routerMock = mockRouter();
				mockWalletControllerConfigured({
					addSeedAccount: addSeedAccountMock
				});
				const screenTester = new ScreenTester(AddSeedAccount);

				// Act:
				screenTester.inputText(SCREEN_TEXT.inputNameLabel, config.nameToType);
				screenTester.pressButton(seedAccount2.address);
				await screenTester.waitForTimer();

				// Assert:
				expect(addSeedAccountMock).toHaveBeenCalledWith({
					type: WalletAccountType.MNEMONIC,
					name: expected.accountName,
					networkIdentifier: CURRENT_NETWORK_IDENTIFIER,
					index: seedAccount2.index
				});
				expect(routerMock.goBack).toHaveBeenCalled();
			});
		};

		const tests = [
			{
				description: 'adds seed account with custom name when account is pressed',
				config: { nameToType: VALID_ACCOUNT_NAME },
				expected: { accountName: VALID_ACCOUNT_NAME }
			},
			{
				description: 'adds seed account with default name when no custom name is provided',
				config: { nameToType: '' },
				expected: { accountName: SCREEN_TEXT.textDefaultAccountName }
			},
			{
				description: 'adds seed account with default name when name is only whitespace',
				config: { nameToType: '   ' },
				expected: { accountName: SCREEN_TEXT.textDefaultAccountName }
			},
			{
				description: 'trims whitespace from custom account name',
				config: { nameToType: '  Test  ' },
				expected: { accountName: 'Test' }
			}
		];

		tests.forEach(test => {
			runAccountSelectionTest(test.description, test.config, test.expected);
		});
	});

	runScreenNavigationTest(AddSeedAccount, {
		navigationActions: [
			{
				buttonText: SCREEN_TEXT.buttonAddExternalAccount,
				actionName: 'goToAddExternalAccount'
			}
		]
	});
});
