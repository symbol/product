import { InputAddress } from '@/app/components/controls/InputAddress';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { runInputTextTest, runRenderTextTest } from '__tests__/component-tests';
import { mockLocalization } from '__tests__/mock-helpers';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const SCREEN_TEXT = {
	inputRecipientLabel: 'input_recipientAddress'
};

const CURRENT_ACCOUNT = AccountFixtureBuilder
	.createWithAccount('symbol', 'mainnet', 0)
	.build();

const RECIPIENT_ACCOUNT = AccountFixtureBuilder
	.createWithAccount('symbol', 'mainnet', 1)
	.build();

const CONTACT_ACCOUNT = AccountFixtureBuilder
	.createWithAccount('symbol', 'mainnet', 2)
	.override({ name: 'Bob Contact' })
	.build();

const ACCOUNTS_WITH_CURRENT = [CURRENT_ACCOUNT];

const ACCOUNTS_WITH_RECIPIENT = [RECIPIENT_ACCOUNT];

const ADDRESS_BOOK_WITH_CONTACT = {
	whiteList: [CONTACT_ACCOUNT]
};

const ADDRESS_BOOK_EMPTY = {
	whiteList: []
};

const createDefaultProps = (overrides = {}) => ({
	label: SCREEN_TEXT.inputRecipientLabel,
	value: '',
	addressBook: undefined,
	accounts: undefined,
	chainName: 'symbol',
	networkIdentifier: 'mainnet',
	onChange: jest.fn(),
	onValidityChange: jest.fn(),
	...overrides
});

describe('components/InputAddress', () => {
	beforeEach(() => {
		mockLocalization();
	});

	runRenderTextTest(InputAddress, {
		props: createDefaultProps({ value: CURRENT_ACCOUNT.address }),
		textToRender: [
			{ type: 'text', value: SCREEN_TEXT.inputRecipientLabel }
		]
	});

	runInputTextTest(InputAddress, {
		props: createDefaultProps({ value: CURRENT_ACCOUNT.address }),
		textToFocus: {
			type: 'input', 
			value: CURRENT_ACCOUNT.address
		},
		testDisabledState: false
	});

	describe('address book icon', () => {
		const runAddressBookIconTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createDefaultProps(config.props);

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
				description: 'shows icon when accounts are provided',
				config: { props: { 
					accounts: ACCOUNTS_WITH_CURRENT 
				} },
				expected: { isVisible: true }
			},
			{
				description: 'shows icon when addressBook has contacts',
				config: { props: { 
					addressBook: ADDRESS_BOOK_WITH_CONTACT 
				} },
				expected: { isVisible: true }
			},
			{
				description: 'hides icon when no contacts available',
				config: { props: { 
					accounts: [], 
					addressBook: ADDRESS_BOOK_EMPTY 
				} },
				expected: { isVisible: false }
			},
			{
				description: 'hides icon when accounts and addressBook are undefined',
				config: { props: {} },
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
			const props = createDefaultProps({ accounts: ACCOUNTS_WITH_RECIPIENT });
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
			const props = createDefaultProps({ 
				accounts: ACCOUNTS_WITH_RECIPIENT, 
				onChange: onChangeMock 
			});
			const { getByLabelText, findByText } = render(<InputAddress {...props} />);

			// Act:
			const addressBookIcon = getByLabelText('address-book');
			fireEvent.press(addressBookIcon);
			const contactItem = await findByText(RECIPIENT_ACCOUNT.address);
			fireEvent.press(contactItem);

			// Assert:
			expect(onChangeMock).toHaveBeenCalledWith(RECIPIENT_ACCOUNT.address);
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
				config: { props: { value: CURRENT_ACCOUNT.address } },
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
