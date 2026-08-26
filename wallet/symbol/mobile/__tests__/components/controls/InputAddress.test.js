import { InputAddress } from '@/app/components/controls/InputAddress';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { runInputTextTest, runRenderTextTest } from '__tests__/component-tests';
import { createAddressBookMock, mockLocalization, mockWalletController } from '__tests__/mock-helpers';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'mainnet';

const SCREEN_TEXT = {
	inputRecipientLabel: 'input_recipientAddress'
};

// Account Fixtures

const currentAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const recipientAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.build();

const contactAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 2)
	.override({ name: 'Bob Contact' })
	.build();

// Props

const createDefaultProps = (overrides = {}) => ({
	label: SCREEN_TEXT.inputRecipientLabel,
	value: '',
	chainName: CHAIN_NAME,
	onChange: jest.fn(),
	onValidityChange: jest.fn(),
	...overrides
});

// The dropdown self-sources its list from the wallet controller, so contacts are configured as state
const mockController = ({ walletAccounts = [], contacts } = {}) => mockWalletController({
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	accounts: { [NETWORK_IDENTIFIER]: walletAccounts },
	modules: contacts === undefined ? {} : { addressBook: createAddressBookMock(contacts) }
});

describe('components/InputAddress', () => {
	beforeEach(() => {
		mockLocalization();
		mockController();
	});

	runRenderTextTest(InputAddress, {
		props: createDefaultProps({ value: currentAccount.address }),
		textToRender: [
			{ type: 'text', value: SCREEN_TEXT.inputRecipientLabel }
		]
	});

	runInputTextTest(InputAddress, {
		props: createDefaultProps({ value: currentAccount.address }),
		textToFocus: {
			type: 'input',
			value: currentAccount.address
		},
		testDisabledState: false
	});

	describe('address book icon', () => {
		const runAddressBookIconTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				mockController(config.controller);
				const props = createDefaultProps();

				// Act:
				const { queryByLabelText } = render(<InputAddress {...props} />);

				// Assert:
				const icon = queryByLabelText('address-book');

				if (expected.isVisible)
					expect(icon).toBeTruthy();
				else
					expect(icon).toBeNull();
			});
		};

		const addressBookIconTests = [
			{
				description: 'shows icon when wallet accounts are available',
				config: { controller: { walletAccounts: [currentAccount] } },
				expected: { isVisible: true }
			},
			{
				description: 'shows icon when the address book has contacts',
				config: { controller: { walletAccounts: [], contacts: [contactAccount] } },
				expected: { isVisible: true }
			},
			{
				description: 'hides icon when no contacts are available',
				config: { controller: { walletAccounts: [], contacts: [] } },
				expected: { isVisible: false }
			},
			{
				description: 'hides icon when the address book is absent',
				config: { controller: { walletAccounts: [] } },
				expected: { isVisible: false }
			}
		];

		addressBookIconTests.forEach(test => {
			runAddressBookIconTest(test.description, test.config, test.expected);
		});
	});

	describe('contacts dropdown', () => {
		it('opens dropdown when address book icon is pressed', async () => {
			// Arrange:
			mockController({ walletAccounts: [recipientAccount] });
			const props = createDefaultProps();
			const { getByLabelText, findAllByText } = render(<InputAddress {...props} />);

			// Act:
			const addressBookIcon = getByLabelText('address-book');
			fireEvent.press(addressBookIcon);

			// Assert:
			const modalTitles = await findAllByText(SCREEN_TEXT.inputRecipientLabel);
			expect(modalTitles.length).toBeGreaterThanOrEqual(2);
		});

		it('calls onChange when contact is selected', async () => {
			// Arrange:
			const onChangeMock = jest.fn();
			mockController({ walletAccounts: [recipientAccount] });
			const props = createDefaultProps({ onChange: onChangeMock });
			const { getByLabelText, findByText } = render(<InputAddress {...props} />);

			// Act:
			const addressBookIcon = getByLabelText('address-book');
			fireEvent.press(addressBookIcon);
			const contactItem = await findByText(recipientAccount.address);
			fireEvent.press(contactItem);

			// Assert:
			expect(onChangeMock).toHaveBeenCalledWith(recipientAccount.address);
		});
	});

	describe('validity change', () => {
		const runValidityChangeTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const onValidityChangeMock = jest.fn();
				const props = createDefaultProps({
					...config.props,
					onValidityChange: onValidityChangeMock
				});

				// Act:
				render(<InputAddress {...props} />);

				// Assert:
				await waitFor(() => {
					expect(onValidityChangeMock).toHaveBeenCalledWith(expected.isValid);
				});
			});
		};

		const validityChangeTests = [
			{
				description: 'calls onValidityChange with true for non-empty value',
				config: { props: { value: currentAccount.address } },
				expected: { isValid: true }
			},
			{
				description: 'calls onValidityChange with false for empty value',
				config: { props: { value: '' } },
				expected: { isValid: false }
			}
		];

		validityChangeTests.forEach(test => {
			runValidityChangeTest(test.description, test.config, test.expected);
		});
	});
});
