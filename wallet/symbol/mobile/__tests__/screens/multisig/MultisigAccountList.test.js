import { MultisigAccountList } from '@/app/screens/multisig/MultisigAccountList';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AccountInfoFixtureBuilder } from '__fixtures__/local/AccountInfoFixtureBuilder';
import { ContactFixtureBuilder } from '__fixtures__/local/ContactFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { createAddressBookMock, mockLocalization, mockRouter, mockWalletController } from '__tests__/mock-helpers';

// Mocks

jest.mock('@react-navigation/native', () => ({
	...jest.requireActual('@react-navigation/native'),
	useIsFocused: () => true
}));

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const TICKER = 'XYM';

// Screen Text

const SCREEN_TEXT = {
	textTitle: 's_multisig_accountList_title',
	textDescription: 's_multisig_accountList_description',
	textDefaultAccountName: 's_multisig_defaultAccountName',
	textEmptyList: 'message_emptyList',
	buttonAddAccount: 'account-add'
};

// Account Fixtures

const currentAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const walletAccount1 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setName('Wallet Account 1')
	.build();

const walletAccount2 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 2)
	.setName('Wallet Account 2')
	.build();

// Contact Fixtures

const contactAlice = ContactFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 3)
	.setName('Alice Contact')
	.build();

// Multisig Account Info Fixtures

const multisigAccountInfo1 = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setBalance('1000')
	.setMultisigStatusByIndexes(true, [0, 2])
	.build();

const multisigAccountInfo2 = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 2)
	.setBalance('2500')
	.setMultisigStatusByIndexes(true, [0, 1])
	.build();

const multisigAccountInfoWithContact = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 3)
	.setBalance('500')
	.setMultisigStatusByIndexes(true, [0])
	.build();

// Multisig Account List Configurations

const multisigAccountsEmpty = [];
const multisigAccountsWithWalletNames = [multisigAccountInfo1, multisigAccountInfo2];
const multisigAccountsWithContactName = [multisigAccountInfoWithContact];

// Mock Factory

const createMultisigModuleMock = (multisigAccounts = []) => ({
	multisigAccounts,
	fetchData: jest.fn().mockResolvedValue(multisigAccounts)
});

// Setup

const setupMocks = (config = {}) => {
	const {
		multisigAccounts = multisigAccountsEmpty,
		contacts = [],
		walletAccounts = [currentAccount, walletAccount1, walletAccount2]
	} = config;

	mockLocalization();
	mockWalletController({
		chainName: CHAIN_NAME,
		networkIdentifier: NETWORK_IDENTIFIER,
		ticker: TICKER,
		currentAccount,
		isWalletReady: true,
		accounts: {
			[NETWORK_IDENTIFIER]: walletAccounts
		},
		modules: {
			addressBook: createAddressBookMock(contacts),
			multisig: createMultisigModuleMock(multisigAccounts)
		}
	});
};

describe('screens/multisig/MultisigAccountList', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('render', () => {
		it('renders screen text with title and description', () => {
			// Arrange:
			setupMocks();
			const expectedTexts = [
				SCREEN_TEXT.textTitle,
				SCREEN_TEXT.textDescription
			];

			// Act:
			const screenTester = new ScreenTester(MultisigAccountList);

			// Assert:
			screenTester.expectText(expectedTexts);
		});
	});

	describe('multisig account list', () => {
		it('renders multisig accounts with wallet account names and addresses', async () => {
			// Arrange:
			setupMocks({ multisigAccounts: multisigAccountsWithWalletNames });
			const expectedNames = [walletAccount1.name, walletAccount2.name];
			const expectedAddresses = [multisigAccountInfo1.address, multisigAccountInfo2.address];

			// Act:
			const screenTester = new ScreenTester(MultisigAccountList);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText(expectedNames);
			screenTester.expectText(expectedAddresses);
		});

		it('renders multisig accounts with contact names when available', async () => {
			// Arrange:
			setupMocks({
				multisigAccounts: multisigAccountsWithContactName,
				contacts: [contactAlice]
			});
			const expectedNames = [contactAlice.name];
			const expectedAddresses = [multisigAccountInfoWithContact.address];

			// Act:
			const screenTester = new ScreenTester(MultisigAccountList);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText(expectedNames);
			screenTester.expectText(expectedAddresses);
		});
	});

	describe('empty state', () => {
		it('renders empty list message when no multisig accounts', async () => {
			// Arrange:
			setupMocks({ multisigAccounts: multisigAccountsEmpty });

			// Act:
			const screenTester = new ScreenTester(MultisigAccountList);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textEmptyList]);
		});
	});

	describe('navigation', () => {
		it('navigates to CreateMultisigAccount screen when add account button is pressed', async () => {
			// Arrange:
			setupMocks();
			const routerMock = mockRouter({
				goToCreateMultisigAccount: jest.fn()
			});

			// Act:
			const screenTester = new ScreenTester(MultisigAccountList);
			await screenTester.waitForTimer();
			screenTester.presButtonByLabel(SCREEN_TEXT.buttonAddAccount);

			// Assert:
			expect(routerMock.goToCreateMultisigAccount).toHaveBeenCalledWith({
				params: {
					chainName: CHAIN_NAME
				}
			});
		});
	});
});
