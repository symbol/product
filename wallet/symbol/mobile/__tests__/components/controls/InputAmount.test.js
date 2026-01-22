import { InputAmount } from '@/app/components/controls/InputAmount';
import { runInputTextTest, runRenderTextTest } from '__tests__/component-tests';
import { mockLocalization } from '__tests__/mock-helpers';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const SCREEN_TEXT = {
	inputAmountLabel: 'input_amount',
	inputAmountPlaceholder: '0',
	textAvailableBalance: 'c_inputAmount_label_available',
	textConfirmTitle: 'c_inputAmount_confirm_title',
	buttonConfirm: 'button_confirm',
	buttonCancel: 'button_cancel'
};

const AVAILABLE_BALANCE = '100';

const createDefaultProps = (overrides = {}) => ({
	label: SCREEN_TEXT.inputAmountLabel,
	value: '',
	availableBalance: undefined,
	price: undefined,
	networkIdentifier: undefined,
	onChange: jest.fn(),
	onValidityChange: jest.fn(),
	...overrides
});

const getAvailableBalanceText = balance => `${SCREEN_TEXT.textAvailableBalance}: ${balance}`;

describe('components/InputAmount', () => {
	beforeEach(() => {
		mockLocalization();
	});

	runRenderTextTest(InputAmount, {
		props: createDefaultProps(),
		textToRender: [
			{ type: 'text', value: SCREEN_TEXT.inputAmountLabel },
			{ type: 'placeholder', value: SCREEN_TEXT.inputAmountPlaceholder }
		]
	});

	runInputTextTest(InputAmount, {
		props: createDefaultProps(),
		textToFocus: {
			type: 'placeholder', 
			value: SCREEN_TEXT.inputAmountPlaceholder
		},
		textToInput: '123.45',
		expectedEventArguments: ['123.45'],
		testDisabledState: false
	});

	describe('input formatting', () => {
		const runInputFormattingTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const onChangeMock = jest.fn();
				const props = createDefaultProps({ onChange: onChangeMock });
				const { getByPlaceholderText } = render(<InputAmount {...props} />);

				// Act:
				const input = getByPlaceholderText(SCREEN_TEXT.inputAmountPlaceholder);
				fireEvent.changeText(input, config.inputText);

				// Assert:
				expect(onChangeMock).toHaveBeenCalledWith(expected.formattedValue);
			});
		};

		const inputFormattingTests = [
			{
				description: 'replaces comma with dot',
				config: { inputText: '10,5' },
				expected: { formattedValue: '10.5' }
			},
			{
				description: 'removes non-numeric characters',
				config: { inputText: '10abc5' },
				expected: { formattedValue: '105' }
			},
			{
				description: 'allows only one decimal point',
				config: { inputText: '10.5.3' },
				expected: { formattedValue: '10.53' }
			},
			{
				description: 'handles plain numbers',
				config: { inputText: '12345' },
				expected: { formattedValue: '12345' }
			}
		];

		inputFormattingTests.forEach(test => {
			runInputFormattingTest(test.description, test.config, test.expected);
		});
	});

	describe('available balance', () => {
		const runAvailableBalanceDisplayTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createDefaultProps(config.props);

				// Act:
				const { queryByText } = render(<InputAmount {...props} />);

				// Assert:
				const balanceText = queryByText(new RegExp(SCREEN_TEXT.textAvailableBalance));

				if (expected.isVisible)
					expect(balanceText).toBeTruthy();
				else
					expect(balanceText).toBeNull();
			});
		};

		const availableBalanceDisplayTests = [
			{
				description: 'displays available balance when provided',
				config: { props: { availableBalance: AVAILABLE_BALANCE } },
				expected: { isVisible: true }
			},
			{
				description: 'does not display available balance when not provided',
				config: { props: { availableBalance: undefined } },
				expected: { isVisible: false }
			}
		];

		availableBalanceDisplayTests.forEach(test => {
			runAvailableBalanceDisplayTest(test.description, test.config, test.expected);
		});
	});

	describe('max amount confirmation', () => {
		it('shows confirmation dialog when available balance is pressed', async () => {
			// Arrange:
			const props = createDefaultProps({ availableBalance: AVAILABLE_BALANCE });
			const { getByText, findByText } = render(<InputAmount {...props} />);

			// Act:
			const availableButton = getByText(getAvailableBalanceText(AVAILABLE_BALANCE));
			fireEvent.press(availableButton);

			// Assert:
			const confirmTitle = await findByText(SCREEN_TEXT.textConfirmTitle);
			expect(confirmTitle).toBeTruthy();
		});

		it('sets max amount when confirmed', async () => {
			// Arrange:
			const onChangeMock = jest.fn();
			const props = createDefaultProps({ 
				availableBalance: AVAILABLE_BALANCE, 
				onChange: onChangeMock 
			});
			const { getByText, findByText } = render(<InputAmount {...props} />);

			// Act:
			const availableButton = getByText(getAvailableBalanceText(AVAILABLE_BALANCE));
			fireEvent.press(availableButton);
			const confirmButton = await findByText(SCREEN_TEXT.buttonConfirm);
			fireEvent.press(confirmButton);

			// Assert:
			await waitFor(() => {
				expect(onChangeMock).toHaveBeenCalledWith(AVAILABLE_BALANCE);
			});
		});
	});

	describe('validity change', () => {
		it('calls onValidityChange on render', async () => {
			// Arrange:
			const onValidityChangeMock = jest.fn();
			const props = createDefaultProps({ 
				value: '', 
				availableBalance: AVAILABLE_BALANCE, 
				onValidityChange: onValidityChangeMock 
			});

			// Act:
			render(<InputAmount {...props} />);

			// Assert:
			await waitFor(() => {
				expect(onValidityChangeMock).toHaveBeenCalled();
			});
		});
	});
});
