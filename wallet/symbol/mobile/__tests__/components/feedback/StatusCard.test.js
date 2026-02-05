import { StatusCard } from '@/app/components/feedback/StatusCard';
import { runRenderTextTest } from '__tests__/component-tests';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

describe('components/StatusCard', () => {
	const createProps = ({ variant, statusText, icon, isLoading } = {}) => ({
		variant: variant ?? 'neutral',
		statusText: statusText ?? 'Status Message',
		icon: icon ?? 'check-circle',
		isLoading: isLoading ?? false
	});

	runRenderTextTest(StatusCard, {
		props: createProps(),
		textToRender: [
			{ type: 'text', value: 'Status Message' }
		]
	});

	describe('icon and loading', () => {
		const runIconLoadingTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.props);

				// Act:
				const { queryByTestId } = render(<StatusCard {...props} />);

				// Assert:
				const icon = queryByTestId(`icon-${props.icon}`);

				if (expected.iconShouldBeVisible)
					expect(icon).toBeTruthy();
				else
					expect(icon).toBeNull();
			});
		};

		const tests = [
			{
				description: 'renders icon when not loading',
				config: {
					props: { isLoading: false, icon: 'check-circle' }
				},
				expected: {
					iconShouldBeVisible: true
				}
			},
			{
				description: 'hides icon when loading',
				config: {
					props: { isLoading: true, icon: 'check-circle' }
				},
				expected: {
					iconShouldBeVisible: false
				}
			}
		];

		tests.forEach(test => {
			runIconLoadingTest(test.description, test.config, test.expected);
		});
	});

	describe('children', () => {
		it('renders children content', () => {
			// Arrange:
			const props = createProps();
			const childText = 'Child Content';

			// Act:
			const { getByText } = render(<StatusCard {...props}>
				<Text>{childText}</Text>
			</StatusCard>);

			// Assert:
			expect(getByText(childText)).toBeTruthy();
		});
	});
});
