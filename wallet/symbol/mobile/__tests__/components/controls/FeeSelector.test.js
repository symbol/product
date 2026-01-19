import { FeeSelector } from '@/app/components/controls/FeeSelector';
import { runRenderTextTest } from '__tests__/component-tests';
import { mockLocalization } from '__tests__/mock-helpers';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/app/lib/controller', () => ({
	walletControllers: {
		main: {
			chainName: 'symbol',
			on: jest.fn(),
			removeListener: jest.fn()
		},
		additional: []
	}
}));

describe('components/FeeSelector', () => {
	beforeEach(() => {
		mockLocalization({
			'selector_fee_slow': 'Slow',
			'selector_fee_medium': 'Medium',
			'selector_fee_fast': 'Fast'
		});
	});

	const createFeeTiers = () => ({
		slow: { token: { amount: '0.1', divisibility: 6 } },
		medium: { token: { amount: '0.5', divisibility: 6 } },
		fast: { token: { amount: '1.0', divisibility: 6 } }
	});

	const createProps = ({ title, feeTiers, value } = {}) => ({
		title: title ?? 'Transaction Fee',
		feeTiers: feeTiers ?? createFeeTiers(),
		value: value ?? 'medium',
		onChange: jest.fn()
	});

	runRenderTextTest(FeeSelector, {
		props: createProps(),
		textToRender: [
			{ type: 'text', value: 'Transaction Fee' }
		]
	});

	describe('fee display', () => {
		const runFeeDisplayTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.props);

				// Act:
				const { getByText } = render(<FeeSelector {...props} />);

				// Assert:
				expect(getByText(expected.displayText)).toBeTruthy();
			});
		};

		const tests = [
			{
				description: 'displays slow fee when value is slow',
				config: {
					props: { value: 'slow' }
				},
				expected: {
					displayText: 'Slow | 0.1 XYM'
				}
			},
			{
				description: 'displays medium fee when value is medium',
				config: {
					props: { value: 'medium' }
				},
				expected: {
					displayText: 'Medium | 0.5 XYM'
				}
			},
			{
				description: 'displays fast fee when value is fast',
				config: {
					props: { value: 'fast' }
				},
				expected: {
					displayText: 'Fast | 1.0 XYM'
				}
			}
		];

		tests.forEach(test => {
			runFeeDisplayTest(test.description, test.config, test.expected);
		});
	});

	describe('onChange', () => {
		it('calls onChange when slider value changes', () => {
			// Arrange:
			const onChange = jest.fn();
			const props = { ...createProps(), onChange };
			const { UNSAFE_getByType } = render(<FeeSelector {...props} />);
			const Slider = require('react-native-smooth-slider').default;
			const slider = UNSAFE_getByType(Slider);

			// Act:
			fireEvent(slider, 'onValueChange', 0);

			// Assert:
			expect(onChange).toHaveBeenCalledWith('slow');
		});

		it('calls onChange with fast when slider moved to max', () => {
			// Arrange:
			const onChange = jest.fn();
			const props = { ...createProps({ value: 'slow' }), onChange };
			const { UNSAFE_getByType } = render(<FeeSelector {...props} />);
			const Slider = require('react-native-smooth-slider').default;
			const slider = UNSAFE_getByType(Slider);

			// Act:
			fireEvent(slider, 'onValueChange', 2);

			// Assert:
			expect(onChange).toHaveBeenCalledWith('fast');
		});
	});

	describe('fee tiers array', () => {
		it('sums fee amounts when feeTiers is an array', () => {
			// Arrange:
			const feeTiersArray = [
				{
					slow: { token: { amount: '0.1', divisibility: 6 } },
					medium: { token: { amount: '0.2', divisibility: 6 } },
					fast: { token: { amount: '0.3', divisibility: 6 } }
				},
				{
					slow: { token: { amount: '0.1', divisibility: 6 } },
					medium: { token: { amount: '0.2', divisibility: 6 } },
					fast: { token: { amount: '0.3', divisibility: 6 } }
				}
			];
			const props = createProps({ feeTiers: feeTiersArray, value: 'slow' });

			// Act:
			const { getByText } = render(<FeeSelector {...props} />);

			// Assert:
			// The sum of slow fees: 0.1 + 0.1 = 0.2
			expect(getByText('Slow | 0.2 XYM')).toBeTruthy();
		});
	});
});
