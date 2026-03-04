import { FeeSelector } from '@/app/components/controls/FeeSelector';
import { runRenderTextTest } from '__tests__/component-tests';
import { mockLocalization } from '__tests__/mock-helpers';
import { fireEvent, render } from '@testing-library/react-native';

const SCREEN_TEXT = {
	textTitle: 'Transaction Fee',
	textFeeSlow: 'selector_fee_slow',
	textFeeMedium: 'selector_fee_medium',
	textFeeFast: 'selector_fee_fast'
};

const FeeTierLevel = {
	SLOW: 'slow',
	MEDIUM: 'medium',
	FAST: 'fast'
};

const SliderValue = {
	SLOW: 0,
	MEDIUM: 1,
	FAST: 2
};

const FEE_TIERS_DEFAULT = {
	slow: { token: { amount: '0.1', divisibility: 6 } },
	medium: { token: { amount: '0.5', divisibility: 6 } },
	fast: { token: { amount: '1.0', divisibility: 6 } }
};

const FEE_TIERS_ARRAY = [
	{
		slow: { token: { amount: '0.1', divisibility: 6 } },
		medium: { token: { amount: '0.10', divisibility: 6 } },
		fast: { token: { amount: '0.100', divisibility: 6 } }
	},
	{
		slow: { token: { amount: '0.2', divisibility: 6 } },
		medium: { token: { amount: '0.20', divisibility: 6 } },
		fast: { token: { amount: '0.200', divisibility: 6 } }
	}
];

const createDefaultProps = (overrides = {}) => ({
	title: SCREEN_TEXT.textTitle,
	feeTiers: FEE_TIERS_DEFAULT,
	value: FeeTierLevel.MEDIUM,
	onChange: jest.fn(),
	ticker: 'XYM',
	...overrides
});

const changeFeeSelectorValue = (renderer, sliderValue) => {
	const Slider = require('react-native-smooth-slider').default;
	const slider = renderer.UNSAFE_getByType(Slider);
	fireEvent(slider, 'onValueChange', sliderValue);
};

describe('components/FeeSelector', () => {
	beforeEach(() => {
		mockLocalization();
	});

	runRenderTextTest(FeeSelector, {
		props: createDefaultProps(),
		textToRender: [
			{ type: 'text', value: SCREEN_TEXT.textTitle }
		]
	});

	describe('fee display', () => {
		const runFeeDisplayTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createDefaultProps(config.props);

				// Act:
				const { getByText } = render(<FeeSelector {...props} />);

				// Assert:
				expect(getByText(expected.displayText)).toBeTruthy();
			});
		};

		const feeDisplayTests = [
			{
				description: 'displays slow fee when value is slow',
				config: { props: { value: FeeTierLevel.SLOW } },
				expected: { displayText: `${SCREEN_TEXT.textFeeSlow} | 0.1 XYM` }
			},
			{
				description: 'displays medium fee when value is medium',
				config: { props: { value: FeeTierLevel.MEDIUM } },
				expected: { displayText: `${SCREEN_TEXT.textFeeMedium} | 0.5 XYM` }
			},
			{
				description: 'displays fast fee when value is fast',
				config: { props: { value: FeeTierLevel.FAST } },
				expected: { displayText: `${SCREEN_TEXT.textFeeFast} | 1.0 XYM` }
			}
		];

		feeDisplayTests.forEach(test => {
			runFeeDisplayTest(test.description, test.config, test.expected);
		});
	});

	describe('onChange', () => {
		const runOnChangeTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const onChangeMock = jest.fn();
				const props = createDefaultProps({ 
					value: config.initialValue, 
					onChange: onChangeMock 
				});
				const renderer = render(<FeeSelector {...props} />);

				// Act:
				changeFeeSelectorValue(renderer, config.sliderValue);

				// Assert:
				expect(onChangeMock).toHaveBeenCalledWith(expected.selectedLevel);
			});
		};

		const onChangeTests = [
			{
				description: 'calls onChange with slow when slider moved to 0',
				config: { initialValue: FeeTierLevel.MEDIUM, sliderValue: SliderValue.SLOW },
				expected: { selectedLevel: FeeTierLevel.SLOW }
			},
			{
				description: 'calls onChange with medium when slider moved to 1',
				config: { initialValue: FeeTierLevel.SLOW, sliderValue: SliderValue.MEDIUM },
				expected: { selectedLevel: FeeTierLevel.MEDIUM }
			},
			{
				description: 'calls onChange with fast when slider moved to 2',
				config: { initialValue: FeeTierLevel.SLOW, sliderValue: SliderValue.FAST },
				expected: { selectedLevel: FeeTierLevel.FAST }
			},
			{
				description: 'calls onChange with slow when slider moved from fast to slow',
				config: { initialValue: FeeTierLevel.FAST, sliderValue: SliderValue.SLOW },
				expected: { selectedLevel: FeeTierLevel.SLOW }
			},
			{
				description: 'calls onChange with fast when slider moved from medium to fast',
				config: { initialValue: FeeTierLevel.MEDIUM, sliderValue: SliderValue.FAST },
				expected: { selectedLevel: FeeTierLevel.FAST }
			}
		];

		onChangeTests.forEach(test => {
			runOnChangeTest(test.description, test.config, test.expected);
		});
	});

	describe('fee tiers array', () => {
		it('sums fee amounts when feeTiers is an array', () => {
			// Arrange:
			const props = createDefaultProps({ 
				feeTiers: FEE_TIERS_ARRAY, 
				value: FeeTierLevel.SLOW 
			});
			const expectedText = `${SCREEN_TEXT.textFeeSlow} | 0.3 XYM`;

			// Act:
			const { getByText } = render(<FeeSelector {...props} />);

			// Assert:
			expect(getByText(expectedText)).toBeTruthy();
		});
	});
});
