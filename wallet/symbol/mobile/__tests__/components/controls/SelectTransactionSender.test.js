import { SelectTransactionSender } from '@/app/components/controls/SelectTransactionSender';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AccountInfoFixtureBuilder } from '__fixtures__/local/AccountInfoFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { createAddressBookMock, mockLocalization, mockWalletController } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const TICKER = 'XYM';

// Screen Text

const SCREEN_TEXT = {
	label: 'input_sender',
	tabCurrentAccount: 'c_selectTransactionSender_currentAccount',
	tabMultisigAccount: 'c_selectTransactionSender_multisigAccount',
	dropdownTitle: 'c_selectTransactionSender_selectTitle',
	defaultMultisigName: 's_multisig_defaultAccountName'
};

// Account Fixtures

const currentAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const firstMultisigAccount = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 3)
	.setBalance('500000000')
	.build();

const secondMultisigAccount = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 4)
	.setBalance('700000000')
	.build();

const MULTISIG_ACCOUNTS = [firstMultisigAccount, secondMultisigAccount];

const senderCurrentAccount = {
	address: currentAccount.address,
	balance: '1000000000'
};

// Props

const createProps = ({ multisigAccounts = [], ...overrides } = {}) => ({
	label: SCREEN_TEXT.label,
	value: currentAccount.address,
	options: { current: senderCurrentAccount, multisigAccounts },
	chainName: CHAIN_NAME,
	onChange: jest.fn(),
	...overrides
});

describe('components/controls/SelectTransactionSender', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		mockLocalization();
		mockWalletController({
			chainName: CHAIN_NAME,
			networkIdentifier: NETWORK_IDENTIFIER,
			ticker: TICKER,
			accounts: { [NETWORK_IDENTIFIER]: [currentAccount] },
			modules: { addressBook: createAddressBookMock() }
		});
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('render', () => {
		it('renders only the current account when there are no multisig accounts', async () => {
			// Arrange:
			const props = createProps();

			// Act:
			const screenTester = new ScreenTester(SelectTransactionSender, props);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText([currentAccount.name, currentAccount.address]);
			screenTester.notExpectText([SCREEN_TEXT.tabCurrentAccount, SCREEN_TEXT.tabMultisigAccount]);
		});

		it('renders the tab selector when there are multisig accounts', async () => {
			// Arrange:
			const props = createProps({ multisigAccounts: MULTISIG_ACCOUNTS });

			// Act:
			const screenTester = new ScreenTester(SelectTransactionSender, props);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText([
				SCREEN_TEXT.tabCurrentAccount,
				SCREEN_TEXT.tabMultisigAccount,
				currentAccount.address
			]);
		});

		it('renders the default name when the selected multisig account is unnamed', async () => {
			// Arrange:
			const props = createProps({
				multisigAccounts: MULTISIG_ACCOUNTS,
				value: firstMultisigAccount.address
			});

			// Act:
			const screenTester = new ScreenTester(SelectTransactionSender, props);
			await screenTester.waitForTimer(); // initial render

			// Assert:
			screenTester.expectText([SCREEN_TEXT.defaultMultisigName, firstMultisigAccount.address]);
		});

		it('renders only the current account when multisig is disabled', async () => {
			// Arrange:
			const props = createProps({
				multisigAccounts: MULTISIG_ACCOUNTS,
				isMultisigDisabled: true
			});

			// Act:
			const screenTester = new ScreenTester(SelectTransactionSender, props);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText([currentAccount.name, currentAccount.address]);
			screenTester.notExpectText([SCREEN_TEXT.tabCurrentAccount, SCREEN_TEXT.tabMultisigAccount]);
		});
	});

	describe('sender selection', () => {
		it('opens the dropdown and fires onChange when a multisig account is selected', async () => {
			// Arrange:
			const onChange = jest.fn();
			const props = createProps({ multisigAccounts: MULTISIG_ACCOUNTS, onChange });

			// Act:
			const screenTester = new ScreenTester(SelectTransactionSender, props);
			await screenTester.waitForTimer();
			screenTester.pressButton(SCREEN_TEXT.tabMultisigAccount);
			await screenTester.waitForTimer();
			screenTester.pressButton(firstMultisigAccount.address);
			await screenTester.waitForTimer();

			// Assert:
			expect(onChange).toHaveBeenCalledWith(firstMultisigAccount.address);
		});

		it('fires onChange with the current account when the current tab is pressed', async () => {
			// Arrange:
			const onChange = jest.fn();
			const props = createProps({
				multisigAccounts: MULTISIG_ACCOUNTS,
				value: firstMultisigAccount.address,
				onChange
			});

			// Act:
			const screenTester = new ScreenTester(SelectTransactionSender, props);
			await screenTester.waitForTimer();
			screenTester.pressButton(SCREEN_TEXT.tabCurrentAccount);
			await screenTester.waitForTimer();

			// Assert:
			expect(onChange).toHaveBeenCalledWith(currentAccount.address);
		});

		it('opens the dropdown when the selected multisig account item is pressed', async () => {
			// Arrange:
			const props = createProps({
				multisigAccounts: MULTISIG_ACCOUNTS,
				value: firstMultisigAccount.address
			});

			// Act:
			const screenTester = new ScreenTester(SelectTransactionSender, props);
			await screenTester.waitForTimer();
			screenTester.notExpectText([SCREEN_TEXT.dropdownTitle]);
			screenTester.presButtonByLabel(SCREEN_TEXT.label);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText([SCREEN_TEXT.dropdownTitle]);
		});
	});
});
