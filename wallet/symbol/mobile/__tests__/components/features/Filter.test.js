import { Filter } from '@/app/components/features/Filter';
import { FilterType } from '@/app/types/Filter';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { runRenderTextTest } from '__tests__/component-tests';
import { mockLocalization } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';

const COMPONENT_TEXT = {
	buttonClear: 'button_clear'
};

// Filter Data Fixtures

const booleanFilter = {
	name: 'isActive',
	title: 'Active',
	type: FilterType.BOOLEAN
};

const selectFilter = {
	name: 'category',
	title: 'Category',
	type: FilterType.SELECT,
	options: [
		{ label: 'Option A', value: 'optionA' },
		{ label: 'Option B', value: 'optionB' },
		{ label: 'Option C', value: 'optionC' }
	]
};

const addressFilter = {
	name: 'senderAddress',
	title: 'Sender',
	type: FilterType.ADDRESS
};

const allFilters = [booleanFilter, selectFilter, addressFilter];

const account = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.data;

// Props Helpers

const createAddressBookMock = contacts => ({
	whiteList: contacts,
	getContactByAddress: address => contacts.find(c => c.address === address) || null
});

const createDefaultProps = (overrides = {}) => ({
	data: allFilters,
	value: {},
	isDisabled: false,
	addressBook: createAddressBookMock([]),
	accounts: [],
	chainName: CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	onChange: jest.fn(),
	...overrides
});

// Render Helper

const createTester = (overrides = {}) => {
	const props = createDefaultProps(overrides);
	const tester = new ScreenTester(Filter, props);
	return { tester, props };
};

describe('components/features/Filter', () => {
	beforeEach(() => {
		mockLocalization();
		jest.clearAllMocks();
	});

	runRenderTextTest(Filter, {
		props: createDefaultProps(),
		textToRender: [
			{ type: 'text', value: booleanFilter.title },
			{ type: 'text', value: selectFilter.title },
			{ type: 'text', value: addressFilter.title },
			{ type: 'text', value: COMPONENT_TEXT.buttonClear }
		]
	});

	describe('boolean filter', () => {
		const runBooleanFilterTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const { tester, props } = createTester({
					value: config.initialValue,
					onChange: jest.fn()
				});

				// Act:
				tester.pressButton(booleanFilter.title);

				// Assert:
				expect(props.onChange).toHaveBeenCalledWith(expected.expectedValue);
			});
		};

		const booleanFilterTests = [
			{
				description: 'calls onChange with true when boolean filter is pressed',
				config: {
					initialValue: {}
				},
				expected: { expectedValue: { [booleanFilter.name]: true } }
			},
			{
				description: 'calls onChange with empty object when active boolean filter is pressed',
				config: {
					initialValue: { [booleanFilter.name]: true }
				},
				expected: { expectedValue: {} }
			}
		];

		booleanFilterTests.forEach(test => {
			runBooleanFilterTest(test.description, test.config, test.expected);
		});
	});

	describe('select filter', () => {
		it('opens dropdown modal when select filter is pressed', () => {
			// Arrange:
			const { tester } = createTester();

			// Act:
			tester.pressButton(selectFilter.title);

			// Assert:
			selectFilter.options.forEach(option => {
				tester.expectText([option.label]);
			});
		});

		const runSelectFilterTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const { tester, props } = createTester();

				// Act:
				tester.pressButton(selectFilter.title);
				tester.pressButton(config.optionToPress);

				// Assert:
				expect(props.onChange).toHaveBeenCalledWith(expected.expectedValue);
			});
		};

		const selectFilterTests = [
			{
				description: 'calls onChange with selected option value',
				config: {
					optionToPress: selectFilter.options[0].label
				},
				expected: {
					expectedValue: { [selectFilter.name]: selectFilter.options[0].value }
				}
			},
			{
				description: 'calls onChange with second option value',
				config: {
					optionToPress: selectFilter.options[1].label
				},
				expected: {
					expectedValue: { [selectFilter.name]: selectFilter.options[1].value }
				}
			}
		];

		selectFilterTests.forEach(test => {
			runSelectFilterTest(test.description, test.config, test.expected);
		});
	});

	describe('address filter', () => {
		it('opens address input dropdown when address filter is pressed', () => {
			// Arrange:
			const { tester } = createTester();
			const expectedDropdownTitle = addressFilter.title;
			const expectedOccurrences = 2; // Chip + Modal Title

			// Act:
			tester.pressButton(addressFilter.title);

			// Assert:
			tester.expectTextCount(expectedDropdownTitle, expectedOccurrences);
		});

		const runAddressFilterTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const { tester, props } = createTester(config.propsOverrides);

				// Act:
				tester.pressButton(addressFilter.title);

				if (config.addressToSelect)
					tester.pressButton(config.addressToSelect);

				// Assert:
				if (expected.shouldCallOnChange)
					expect(props.onChange).toHaveBeenCalledWith(expected.expectedValue);
				else
					expect(props.onChange).not.toHaveBeenCalled();
			});
		};

		const addressFilterTests = [
			{
				description: 'renders address book contacts in dropdown',
				config: {
					propsOverrides: {
						addressBook: createAddressBookMock([account])
					},
					addressToSelect: null
				},
				expected: {
					shouldCallOnChange: false
				}
			},
			{
				description: 'calls onChange when contact is selected',
				config: {
					propsOverrides: {
						addressBook: createAddressBookMock([account])
					},
					addressToSelect: account.name
				},
				expected: {
					shouldCallOnChange: true,
					expectedValue: { [addressFilter.name]: account.address }
				}
			},
			{
				description: 'calls onChange when account is selected',
				config: {
					propsOverrides: {
						accounts: [account]
					},
					addressToSelect: account.name
				},
				expected: {
					shouldCallOnChange: true,
					expectedValue: { [addressFilter.name]: account.address }
				}
			}
		];

		addressFilterTests.forEach(test => {
			runAddressFilterTest(test.description, test.config, test.expected);
		});
	});

	describe('clear filter', () => {
		const runClearFilterTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const { tester, props } = createTester({
					value: config.initialValue
				});

				// Act:
				tester.pressButton(COMPONENT_TEXT.buttonClear);

				// Assert:
				if (expected.shouldCallOnChange)
					expect(props.onChange).toHaveBeenCalledWith(expected.expectedValue);
				else
					expect(props.onChange).not.toHaveBeenCalled();
			});
		};

		const clearFilterTests = [
			{
				description: 'calls onChange with empty object when clear is pressed',
				config: {
					initialValue: { [booleanFilter.name]: true }
				},
				expected: { shouldCallOnChange: true, expectedValue: {} }
			},
			{
				description: 'does not call onChange when clear is pressed with empty value',
				config: {
					initialValue: {}
				},
				expected: { shouldCallOnChange: false }
			}
		];

		clearFilterTests.forEach(test => {
			runClearFilterTest(test.description, test.config, test.expected);
		});
	});

	describe('disabled state', () => {
		const runDisabledStateTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const { tester, props } = createTester({
					value: config.initialValue,
					isDisabled: true
				});

				// Act:
				tester.pressButton(config.elementToPress);

				// Assert:
				if (expected.shouldCallOnChange)
					expect(props.onChange).toHaveBeenCalled();
				else
					expect(props.onChange).not.toHaveBeenCalled();
			});
		};

		const disabledStateTests = [
			{
				description: 'does not call onChange when filter is disabled',
				config: {
					elementToPress: booleanFilter.title,
					initialValue: {}
				},
				expected: { shouldCallOnChange: false }
			},
			{
				description: 'does not call onChange when clear is disabled',
				config: {
					elementToPress: COMPONENT_TEXT.buttonClear,
					initialValue: { [booleanFilter.name]: true }
				},
				expected: { shouldCallOnChange: false }
			}
		];

		disabledStateTests.forEach(test => {
			runDisabledStateTest(test.description, test.config, test.expected);
		});
	});

	describe('filter availability', () => {
		const runFilterAvailabilityTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const { tester, props } = createTester({
					value: config.activeValue
				});

				// Act:
				tester.pressButton(config.filterToPress);

				// Assert:
				if (expected.shouldCallOnChange)
					expect(props.onChange).toHaveBeenCalled();
				else
					expect(props.onChange).not.toHaveBeenCalled();
			});
		};

		const filterAvailabilityTests = [
			{
				description: 'allows pressing filter when no filters are active',
				config: {
					activeValue: {},
					filterToPress: booleanFilter.title
				},
				expected: { shouldCallOnChange: true }
			},
			{
				description: 'allows pressing active filter to deactivate',
				config: {
					activeValue: { [booleanFilter.name]: true },
					filterToPress: booleanFilter.title
				},
				expected: { shouldCallOnChange: true }
			},
			{
				description: 'prevents pressing non-active filter when another is active',
				config: {
					activeValue: { [booleanFilter.name]: true },
					filterToPress: selectFilter.title
				},
				expected: { shouldCallOnChange: false }
			}
		];

		filterAvailabilityTests.forEach(test => {
			runFilterAvailabilityTest(test.description, test.config, test.expected);
		});
	});

	describe('filter value management', () => {
		const runValueManagementTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const { tester, props } = createTester({
					value: config.initialValue
				});

				// Act:
				tester.pressButton(config.filterToPress);

				// Assert:
				if (expected.expectedValue !== undefined)
					expect(props.onChange).toHaveBeenCalledWith(expected.expectedValue);
			});
		};

		const valueManagementTests = [
			{
				description: 'adds filter value when activating boolean filter',
				config: {
					initialValue: {},
					filterToPress: booleanFilter.title
				},
				expected: { expectedValue: { [booleanFilter.name]: true } }
			},
			{
				description: 'removes filter value when deactivating boolean filter',
				config: {
					initialValue: { [booleanFilter.name]: true },
					filterToPress: booleanFilter.title
				},
				expected: { expectedValue: {} }
			}
		];

		valueManagementTests.forEach(test => {
			runValueManagementTest(test.description, test.config, test.expected);
		});
	});
});
