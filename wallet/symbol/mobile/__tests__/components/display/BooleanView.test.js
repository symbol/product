import { BooleanView } from '@/app/components/display/BooleanView';
import { runRenderComponentTest } from '__tests__/component-tests';
import { render } from '@testing-library/react-native';

describe('components/BooleanView', () => {
	const createProps = ({ value, text } = {}) => ({
		value: value ?? true,
		text: text
	});

	runRenderComponentTest(BooleanView, {
		props: createProps()
	});

	describe('icon', () => {
		const runIconTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.props);

				// Act:
				const { queryByTestId } = render(<BooleanView {...props} />);

				// Assert:
				expect(queryByTestId(`icon-${expected.iconName}`)).toBeTruthy();
			});
		};

		const tests = [
			{
				description: 'renders check icon when value is true',
				config: {
					props: { value: true }
				},
				expected: {
					iconName: 'check'
				}
			},
			{
				description: 'renders cross icon when value is false',
				config: {
					props: { value: false }
				},
				expected: {
					iconName: 'cross'
				}
			}
		];

		tests.forEach(test => {
			runIconTest(test.description, test.config, test.expected);
		});
	});

	describe('text', () => {
		const runTextTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.props);

				// Act:
				const { queryByText } = render(<BooleanView {...props} />);

				// Assert:
				if (expected.textShouldBeVisible)
					expect(queryByText(config.props.text)).toBeTruthy();
				else
					expect(queryByText('any text')).toBeNull();
			});
		};

		const tests = [
			{
				description: 'renders text when provided',
				config: {
					props: { value: true, text: 'Enabled' }
				},
				expected: {
					textShouldBeVisible: true
				}
			},
			{
				description: 'does not render text when not provided',
				config: {
					props: { value: true }
				},
				expected: {
					textShouldBeVisible: false
				}
			}
		];

		tests.forEach(test => {
			runTextTest(test.description, test.config, test.expected);
		});
	});
});
