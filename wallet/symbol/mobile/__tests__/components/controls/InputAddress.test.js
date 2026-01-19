import { InputAddress } from '@/app/components/controls/InputAddress';
import { runInputTextTest, runRenderTextTest } from '__tests__/component-tests';
import { mockLocalization } from '__tests__/mock-helpers';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

describe('components/InputAddress', () => {
	beforeEach(() => {
		mockLocalization({
			'v_error_required': 'This field is required'
		});
	});

	const createProps = ({ label, value, addressBook, accounts, chainName, networkIdentifier } = {}) => ({
		label: label ?? 'Recipient Address',
		value: value ?? '',
		addressBook: addressBook,
		accounts: accounts,
		chainName: chainName ?? 'symbol',
		networkIdentifier: networkIdentifier ?? 'mainnet',
		onChange: jest.fn(),
		onValidityChange: jest.fn()
	});

	runRenderTextTest(InputAddress, {
		props: createProps({ value: 'TALICE...' }),
		textToRender: [
			{ type: 'text', value: 'Recipient Address' }
		]
	});

	runInputTextTest(InputAddress, {
		props: createProps({ value: 'TALICE...' }),
		textToFocus: {
			type: 'input', value: 'TALICE...'
		},
		testDisabledState: false
	});

	describe('address book icon', () => {
		const runAddressBookIconTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.props);

				// Act:
				const { queryByTestId } = render(<InputAddress {...props} />);

				// Assert:
				const icon = queryByTestId('icon-address-book');

				if (expected.iconShouldBeVisible)
					expect(icon).toBeTruthy();
				else
					expect(icon).toBeNull();
			});
		};

		const tests = [
			{
				description: 'shows address book icon when accounts are provided',
				config: {
					props: {
						accounts: [
							{ address: 'TALICE...', name: 'Alice' }
						]
					}
				},
				expected: {
					iconShouldBeVisible: true
				}
			},
			{
				description: 'shows address book icon when addressBook has contacts',
				config: {
					props: {
						addressBook: {
							whiteList: [
								{ address: 'TBOB...', name: 'Bob' }
							]
						}
					}
				},
				expected: {
					iconShouldBeVisible: true
				}
			},
			{
				description: 'hides address book icon when no contacts available',
				config: {
					props: {
						accounts: [],
						addressBook: { whiteList: [] }
					}
				},
				expected: {
					iconShouldBeVisible: false
				}
			},
			{
				description: 'hides address book icon when accounts and addressBook are undefined',
				config: {
					props: {}
				},
				expected: {
					iconShouldBeVisible: false
				}
			}
		];

		tests.forEach(test => {
			runAddressBookIconTest(test.description, test.config, test.expected);
		});
	});

	describe('contacts dropdown', () => {
		it('opens dropdown when address book icon is pressed', async () => {
			// Arrange:
			const accounts = [
				{ address: 'TALICE123...', name: 'Alice' }
			];
			const props = createProps({ accounts });
			const { getByTestId, findAllByText } = render(<InputAddress {...props} />);

			// Act:
			const addressBookIcon = getByTestId('icon-address-book');
			fireEvent.press(addressBookIcon);

			// Assert:
			// Modal title appears in both the TextBox label and modal header
			const modalTitles = await findAllByText('Recipient Address');
			expect(modalTitles.length).toBeGreaterThanOrEqual(2);
		});

		it('calls onChange when contact is selected', async () => {
			// Arrange:
			const accounts = [
				{ address: 'TALICE123...', name: 'Alice' }
			];
			const onChange = jest.fn();
			const props = { ...createProps({ accounts }), onChange };
			const { getByTestId, findByText } = render(<InputAddress {...props} />);

			// Act:
			const addressBookIcon = getByTestId('icon-address-book');
			fireEvent.press(addressBookIcon);
			
			const contactItem = await findByText('TALICE123...');
			fireEvent.press(contactItem);

			// Assert:
			expect(onChange).toHaveBeenCalledWith('TALICE123...');
		});
	});

	describe('validity change', () => {
		const runValidityTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const onValidityChange = jest.fn();
				const props = { 
					...createProps(config.props), 
					onValidityChange 
				};

				// Act:
				render(<InputAddress {...props} />);

				// Assert:
				await waitFor(() => {
					expect(onValidityChange).toHaveBeenCalledWith(expected.isValid);
				});
			});
		};

		const tests = [
			{
				description: 'calls onValidityChange with true for non-empty value',
				config: {
					props: { value: 'TALICE...' }
				},
				expected: {
					isValid: true
				}
			},
			{
				description: 'calls onValidityChange with false for empty value',
				config: {
					props: { value: '' }
				},
				expected: {
					isValid: false
				}
			}
		];

		tests.forEach(test => {
			runValidityTest(test.description, test.config, test.expected);
		});
	});
});
