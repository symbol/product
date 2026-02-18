import { ActivityLogView } from '@/app/components/display/ActivityLogView';
import { ActivityStatus } from '@/app/constants';
import { runRenderComponentTest, runRenderTextTest } from '__tests__/component-tests';
import { render } from '@testing-library/react-native';

describe('components/ActivityLogView', () => {
	const createActivityItem = ({ title, icon, status, caption } = {}) => ({
		title: title ?? 'Activity Title',
		icon: icon ?? 'check',
		status: status ?? ActivityStatus.PENDING,
		caption: caption ?? ''
	});

	const createProps = ({ data } = {}) => ({
		data: data ?? [createActivityItem()]
	});

	runRenderComponentTest(ActivityLogView, {
		props: createProps()
	});

	runRenderTextTest(ActivityLogView, {
		props: createProps({
			data: [createActivityItem({ title: 'Test Activity' })]
		}),
		textToRender: [
			{ type: 'text', value: 'Test Activity' }
		]
	});

	describe('activity items', () => {
		const runActivityItemsTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.props);

				// Act:
				const { queryAllByText, queryByText } = render(<ActivityLogView {...props} />);

				// Assert:
				expected.visibleTexts.forEach(text => {
					const elements = queryAllByText(text);
					expect(elements.length).toBeGreaterThan(0);
				});

				if (expected.hiddenTexts) {
					expected.hiddenTexts.forEach(text => {
						expect(queryByText(text)).toBeNull();
					});
				}
			});
		};

		const tests = [
			{
				description: 'renders single activity item',
				config: {
					props: {
						data: [
							createActivityItem({ title: 'Create Transaction' })
						]
					}
				},
				expected: {
					visibleTexts: ['Create Transaction']
				}
			},
			{
				description: 'renders multiple activity items',
				config: {
					props: {
						data: [
							createActivityItem({ title: 'Step 1' }),
							createActivityItem({ title: 'Step 2' }),
							createActivityItem({ title: 'Step 3' })
						]
					}
				},
				expected: {
					visibleTexts: ['Step 1', 'Step 2', 'Step 3']
				}
			},
			{
				description: 'renders activity item with caption',
				config: {
					props: {
						data: [
							createActivityItem({ 
								title: 'Failed Step', 
								caption: 'Error message' 
							})
						]
					}
				},
				expected: {
					visibleTexts: ['Failed Step', 'Error message']
				}
			},
			{
				description: 'does not render caption when empty',
				config: {
					props: {
						data: [
							createActivityItem({ 
								title: 'Step Without Caption', 
								caption: '' 
							})
						]
					}
				},
				expected: {
					visibleTexts: ['Step Without Caption']
				}
			}
		];

		tests.forEach(test => {
			runActivityItemsTest(test.description, test.config, test.expected);
		});
	});

	describe('icon display', () => {
		const runIconTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.props);

				// Act:
				const { queryByTestId } = render(<ActivityLogView {...props} />);

				// Assert:
				if (expected.iconVisible) 
					expect(queryByTestId(`icon-${config.props.data[0].icon}`)).toBeTruthy();
				
			});
		};

		const tests = [
			{
				description: 'renders icon for pending status',
				config: {
					props: {
						data: [createActivityItem({ icon: 'plus', status: ActivityStatus.PENDING })]
					}
				},
				expected: {
					iconVisible: true
				}
			},
			{
				description: 'renders icon for complete status',
				config: {
					props: {
						data: [createActivityItem({ icon: 'check', status: ActivityStatus.COMPLETE })]
					}
				},
				expected: {
					iconVisible: true
				}
			},
			{
				description: 'renders icon for error status',
				config: {
					props: {
						data: [createActivityItem({ icon: 'cross', status: ActivityStatus.ERROR })]
					}
				},
				expected: {
					iconVisible: true
				}
			}
		];

		tests.forEach(test => {
			runIconTest(test.description, test.config, test.expected);
		});
	});

	describe('loading state', () => {
		it('shows loading indicator when status is loading', () => {
			// Arrange:
			const props = createProps({
				data: [createActivityItem({ icon: 'check', status: ActivityStatus.LOADING })]
			});

			// Act:
			const { queryByTestId } = render(<ActivityLogView {...props} />);

			// Assert:
			expect(queryByTestId('loading-indicator')).toBeTruthy();
		});

		it('hides icon when status is loading', () => {
			// Arrange:
			const props = createProps({
				data: [createActivityItem({ icon: 'check', status: ActivityStatus.LOADING })]
			});

			// Act:
			const { queryByTestId } = render(<ActivityLogView {...props} />);

			// Assert:
			expect(queryByTestId('icon-check')).toBeNull();
		});
	});
});
