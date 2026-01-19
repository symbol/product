import { Alert } from '@/app/components/feedback/Alert';
import { runRenderTextTest } from '__tests__/component-tests';
import { render } from '@testing-library/react-native';

describe('components/Alert', () => {
	const createProps = ({ variant, title, body, isIconHidden } = {}) => ({
		variant: variant ?? 'neutral',
		title: title,
		body: body ?? 'Test alert message',
		isIconHidden: isIconHidden ?? false
	});

	runRenderTextTest(Alert, {
		props: createProps(),
		textToRender: [
			{ type: 'text', value: 'Test alert message' }
		]
	});

	describe('title', () => {
		const runTitleTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.props);

				// Act:
				const { queryByText } = render(<Alert {...props} />);

				// Assert:
				if (expected.titleShouldBeVisible)
					expect(queryByText(config.props.title)).toBeTruthy();
				else
					expect(queryByText('Test Title')).toBeNull();
			});
		};

		const tests = [
			{
				description: 'renders title when provided',
				config: {
					props: { title: 'Test Title', body: 'Test body' }
				},
				expected: {
					titleShouldBeVisible: true
				}
			},
			{
				description: 'does not render title when not provided',
				config: {
					props: { body: 'Test body' }
				},
				expected: {
					titleShouldBeVisible: false
				}
			}
		];

		tests.forEach(test => {
			runTitleTest(test.description, test.config, test.expected);
		});
	});

	describe('icon', () => {
		const runIconTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.props);

				// Act:
				const { queryByTestId } = render(<Alert {...props} />);

				// Assert:
				const icon = queryByTestId(`icon-${expected.iconName}`);

				if (expected.iconShouldBeVisible)
					expect(icon).toBeTruthy();
				else
					expect(icon).toBeNull();
			});
		};

		const tests = [
			{
				description: 'renders info-circle icon for neutral variant',
				config: {
					props: { variant: 'neutral' }
				},
				expected: {
					iconShouldBeVisible: true,
					iconName: 'info-circle'
				}
			},
			{
				description: 'renders check-circle icon for success variant',
				config: {
					props: { variant: 'success' }
				},
				expected: {
					iconShouldBeVisible: true,
					iconName: 'check-circle'
				}
			},
			{
				description: 'renders alert-warning icon for warning variant',
				config: {
					props: { variant: 'warning' }
				},
				expected: {
					iconShouldBeVisible: true,
					iconName: 'alert-warning'
				}
			},
			{
				description: 'renders alert-danger icon for danger variant',
				config: {
					props: { variant: 'danger' }
				},
				expected: {
					iconShouldBeVisible: true,
					iconName: 'alert-danger'
				}
			},
			{
				description: 'hides icon when isIconHidden is true',
				config: {
					props: { variant: 'neutral', isIconHidden: true }
				},
				expected: {
					iconShouldBeVisible: false,
					iconName: 'info-circle'
				}
			}
		];

		tests.forEach(test => {
			runIconTest(test.description, test.config, test.expected);
		});
	});
});
