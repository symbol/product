import { Dropdown } from '@/app/components/controls/Dropdown';
import { runDropdownSelectTest, runRenderTextTest } from '__tests__/component-tests';
import { fireEvent, render } from '@testing-library/react-native';

describe('components/Dropdown', () => {
	const defaultList = [
		{ value: 'option1', label: 'Option 1' },
		{ value: 'option2', label: 'Option 2' },
		{ value: 'option3', label: 'Option 3' }
	];

	const createProps = ({ value, label, list, isDisabled } = {}) => ({
		value: value ?? 'option1',
		label: label ?? 'Test Label',
		list: list ?? defaultList,
		isDisabled: isDisabled ?? false,
		onChange: jest.fn()
	});

	runRenderTextTest(Dropdown, {
		props: createProps(),
		textToRender: [
			{ type: 'text', value: 'Test Label' },
			{ type: 'text', value: 'Option 1' }
		]
	});

	runDropdownSelectTest(Dropdown, {
		props: createProps(),
		textToPress: 'Option 1',
		items: defaultList,
		testDisabledState: true
	});

	describe('modal', () => {
		const runModalTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const props = createProps(config.props);
				const { getByText, queryByText, findAllByText } = render(<Dropdown {...props} />);

				// Act:
				if (config.shouldOpen) {
					const trigger = getByText(config.textToPress);
					fireEvent.press(trigger);
				}

				// Assert:
				if (expected.modalShouldBeVisible) {
					// Modal title appears twice (in dropdown label and modal header)
					const modalTitles = await findAllByText(props.label);
					expect(modalTitles.length).toBeGreaterThanOrEqual(2);

					// Check that non-selected options appear in the modal
					expect(queryByText('Option 2')).toBeTruthy();
					expect(queryByText('Option 3')).toBeTruthy();
				}
				else {
					// Modal title should only appear once (in the dropdown, not duplicated in modal)
					const modalTitles = await findAllByText(props.label);
					expect(modalTitles.length).toBe(1);

					// Check that non-selected options do not appear (dropdown closed)
					expect(queryByText('Option 2')).toBeNull();
					expect(queryByText('Option 3')).toBeNull();
				}
			});
		};

		const tests = [
			{
				description: 'opens modal when dropdown is pressed',
				config: {
					props: {},
					shouldOpen: true,
					textToPress: 'Option 1'
				},
				expected: {
					modalShouldBeVisible: true
				}
			},
			{
				description: 'does not open modal when dropdown is not pressed',
				config: {
					props: {},
					shouldOpen: false,
					textToPress: 'Option 1'
				},
				expected: {
					modalShouldBeVisible: false
				}
			},
			{
				description: 'does not open modal when dropdown is disabled',
				config: {
					props: { isDisabled: true },
					shouldOpen: true,
					textToPress: 'Option 1'
				},
				expected: {
					modalShouldBeVisible: false
				}
			}
		];

		tests.forEach(test => {
			runModalTest(test.description, test.config, test.expected);
		});
	});

	describe('value display', () => {
		const runValueDisplayTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.props);

				// Act:
				const { getByText } = render(<Dropdown {...props} />);

				// Assert:
				expect(getByText(expected.displayedValue)).toBeTruthy();
			});
		};

		const tests = [
			{
				description: 'displays label for selected value',
				config: {
					props: { value: 'option2' }
				},
				expected: {
					displayedValue: 'Option 2'
				}
			},
			{
				description: 'displays value directly if no matching label found',
				config: {
					props: { value: 'unknown-value' }
				},
				expected: {
					displayedValue: 'unknown-value'
				}
			}
		];

		tests.forEach(test => {
			runValueDisplayTest(test.description, test.config, test.expected);
		});
	});
});
