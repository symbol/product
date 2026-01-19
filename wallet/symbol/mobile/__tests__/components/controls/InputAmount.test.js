import { InputAmount } from '@/app/components/controls/InputAmount';
import { runInputTextTest, runRenderTextTest } from '__tests__/component-tests';
import { mockLocalization } from '__tests__/mock-helpers';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

describe('components/InputAmount', () => {
	beforeEach(() => {
		mockLocalization({
			'c_inputAmount_label_available': 'Available',
			'c_inputAmount_confirm_title': 'Confirm Amount',
			'c_inputAmount_confirm_text': 'Are you sure you want to use the entire available amount?',
			'button_confirm': 'Confirm',
			'button_cancel': 'Cancel'
		});
	});

	const createProps = ({ label, value, availableBalance, price, networkIdentifier } = {}) => ({
		label: label ?? 'Amount',
		value: value ?? '',
		availableBalance: availableBalance,
		price: price,
		networkIdentifier: networkIdentifier,
		onChange: jest.fn(),
		onValidityChange: jest.fn()
	});

	runRenderTextTest(InputAmount, {
		props: createProps(),
		textToRender: [
			{ type: 'text', value: 'Amount' },
			{ type: 'placeholder', value: '0' }
		]
	});

	runInputTextTest(InputAmount, {
		props: createProps({ value: '' }),
		textToFocus: {
			type: 'placeholder', value: '0'
		},
		textToInput: '123.45',
		expectedEventArguments: ['123.45'],
		testDisabledState: false
	});

	describe('input formatting', () => {
		const runFormattingTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const onChange = jest.fn();
				const props = { ...createProps(config.props), onChange };
				const { getByPlaceholderText } = render(<InputAmount {...props} />);

				// Act:
				const input = getByPlaceholderText('0');
				fireEvent.changeText(input, config.inputText);

				// Assert:
				expect(onChange).toHaveBeenCalledWith(expected.formattedValue);
			});
		};

		const tests = [
			{
				description: 'replaces comma with dot',
				config: {
					props: {},
					inputText: '10,5'
				},
				expected: {
					formattedValue: '10.5'
				}
			},
			{
				description: 'removes non-numeric characters',
				config: {
					props: {},
					inputText: '10abc5'
				},
				expected: {
					formattedValue: '105'
				}
			},
			{
				description: 'allows only one decimal point',
				config: {
					props: {},
					inputText: '10.5.3'
				},
				expected: {
					formattedValue: '10.53'
				}
			},
			{
				description: 'handles plain numbers',
				config: {
					props: {},
					inputText: '12345'
				},
				expected: {
					formattedValue: '12345'
				}
			}
		];

		tests.forEach(test => {
			runFormattingTest(test.description, test.config, test.expected);
		});
	});

	describe('available balance', () => {
		it('displays available balance when provided', () => {
			// Arrange:
			const props = createProps({ availableBalance: '100' });

			// Act:
			const { getByText } = render(<InputAmount {...props} />);

			// Assert:
			expect(getByText('Available: 100')).toBeTruthy();
		});

		it('does not display available balance when not provided', () => {
			// Arrange:
			const props = createProps({ availableBalance: undefined });

			// Act:
			const { queryByText } = render(<InputAmount {...props} />);

			// Assert:
			expect(queryByText(/Available:/)).toBeNull();
		});
	});

	describe('max amount confirmation', () => {
		it('shows confirmation dialog when available balance is pressed', async () => {
			// Arrange:
			const props = createProps({ availableBalance: '100' });
			const { getByText, findByText } = render(<InputAmount {...props} />);

			// Act:
			const availableButton = getByText('Available: 100');
			fireEvent.press(availableButton);

			// Assert:
			const confirmTitle = await findByText('Confirm Amount');
			expect(confirmTitle).toBeTruthy();
		});

		it('sets max amount when confirmed', async () => {
			// Arrange:
			const onChange = jest.fn();
			const props = { ...createProps({ availableBalance: '100' }), onChange };
			const { getByText, findByText } = render(<InputAmount {...props} />);

			// Act:
			const availableButton = getByText('Available: 100');
			fireEvent.press(availableButton);
			
			const confirmButton = await findByText('Confirm');
			fireEvent.press(confirmButton);

			// Assert:
			await waitFor(() => {
				expect(onChange).toHaveBeenCalledWith('100');
			});
		});
	});

	describe('validity change', () => {
		it('calls onValidityChange when value changes', async () => {
			// Arrange:
			const onValidityChange = jest.fn();
			const props = { 
				...createProps({ value: '', availableBalance: '100' }), 
				onValidityChange 
			};

			// Act:
			render(<InputAmount {...props} />);

			// Assert:
			await waitFor(() => {
				expect(onValidityChange).toHaveBeenCalled();
			});
		});
	});
});
