import { FilteredListScreenTemplate } from '@/app/components/templates/FilteredListScreenTemplate/FilteredListScreenTemplate';
import { FilterType } from '@/app/types/Filter';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockWalletController } from '__tests__/mock-helpers';
import React from 'react';
import { Text } from 'react-native';

// Constants

const COMPONENT_TEXT = {
	// Filter
	textFilterBoolean: 'Boolean Filter',
	buttonClear: 'button_clear',
	// Empty state
	textEmptyList: 'message_emptyList',
	// Custom render markers
	textScreenHeader: 'Custom Screen Header',
	textListHeader: 'Custom List Header',
	textScreenBottom: 'Custom Screen Bottom',
	textCustomSectionHeader: 'Custom Section Header',
	textPlaceholder: 'Placeholder Item'
};

// Section Fixtures

const SECTION_GROUP_FIRST = 'firstGroup';
const SECTION_GROUP_SECOND = 'secondGroup';

const firstSection = {
	title: 'First Section',
	group: SECTION_GROUP_FIRST,
	data: [
		{ id: 'item-1', label: 'Item One' },
		{ id: 'item-2', label: 'Item Two' }
	]
};

const secondSection = {
	title: 'Second Section',
	group: SECTION_GROUP_SECOND,
	data: [{ id: 'item-3', label: 'Item Three' }]
};

const allSections = [firstSection, secondSection];

// Filter Fixtures

const booleanFilter = {
	name: 'isActive',
	title: COMPONENT_TEXT.textFilterBoolean,
	type: FilterType.BOOLEAN
};

// Props Helpers

const createDefaultProps = (overrides = {}) => ({
	listKey: 'test-list-key',
	sections: allSections,
	filterConfig: [booleanFilter],
	filterValue: {},
	onFilterChange: jest.fn(),
	isLoading: false,
	isRefreshing: false,
	isPageLoading: false,
	onRefresh: jest.fn(),
	onEndReached: jest.fn(),
	keyExtractor: item => item.id,
	renderItem: ({ item }) => <Text>{item.label}</Text>,
	...overrides
});

// Render Helper

const createTester = (overrides = {}) => {
	mockWalletController();
	const props = createDefaultProps(overrides);
	const tester = new ScreenTester(FilteredListScreenTemplate, props);

	return { tester, props };
};

describe('components/templates/FilteredListScreenTemplate', () => {
	beforeEach(() => {
		mockLocalization();
		jest.clearAllMocks();
	});

	describe('list rendering', () => {
		it('renders section titles and items', () => {
			// Arrange & Act:
			const { tester } = createTester();

			// Assert:
			tester.expectText([
				firstSection.title,
				secondSection.title,
				...firstSection.data.map(item => item.label),
				...secondSection.data.map(item => item.label)
			]);
		});

		it('renders custom section header instead of the default title', () => {
			// Arrange & Act:
			const { tester } = createTester({
				renderSectionHeader: () => <Text>{COMPONENT_TEXT.textCustomSectionHeader}</Text>
			});

			// Assert:
			tester.expectTextCount(COMPONENT_TEXT.textCustomSectionHeader, allSections.length);
			tester.notExpectText([firstSection.title, secondSection.title]);
		});
	});

	describe('screen header', () => {
		it('renders the screen header when renderScreenHeader is provided', () => {
			// Arrange & Act:
			const { tester } = createTester({
				renderScreenHeader: () => <Text>{COMPONENT_TEXT.textScreenHeader}</Text>
			});

			// Assert:
			tester.expectText([COMPONENT_TEXT.textScreenHeader]);
		});

		it('renders no screen header when renderScreenHeader is omitted', () => {
			// Arrange & Act:
			const { tester } = createTester();

			// Assert:
			tester.notExpectText([COMPONENT_TEXT.textScreenHeader]);
		});
	});

	describe('filter', () => {
		it('renders the filter chips and calls onFilterChange on chip press', () => {
			// Arrange:
			const { tester, props } = createTester();

			// Act:
			tester.pressButton(COMPONENT_TEXT.textFilterBoolean);

			// Assert:
			tester.expectText([COMPONENT_TEXT.buttonClear]);
			expect(props.onFilterChange).toHaveBeenCalledWith({ [booleanFilter.name]: true });
		});

		const runFilterDisabledTest = (description, config) => {
			it(description, () => {
				// Arrange:
				const { tester, props } = createTester(config.propsOverrides);

				// Act:
				tester.pressButton(COMPONENT_TEXT.textFilterBoolean);

				// Assert:
				expect(props.onFilterChange).not.toHaveBeenCalled();
			});
		};

		const filterDisabledTests = [
			{
				description: 'disables the filter while initial loading',
				config: { propsOverrides: { isLoading: true } }
			},
			{
				description: 'disables the filter while refreshing',
				config: { propsOverrides: { isRefreshing: true } }
			},
			{
				description: 'disables the filter when isFilterDisabled is set',
				config: { propsOverrides: { isFilterDisabled: true } }
			}
		];

		filterDisabledTests.forEach(test => {
			runFilterDisabledTest(test.description, test.config);
		});
	});

	describe('empty state', () => {
		const runEmptyStateTest = (description, config, expected) => {
			it(description, () => {
				// Arrange & Act:
				const { tester } = createTester({
					sections: [],
					...config.propsOverrides
				});

				// Assert:
				if (expected.isPlaceholderShown)
					tester.expectText([COMPONENT_TEXT.textEmptyList]);
				else
					tester.notExpectText([COMPONENT_TEXT.textEmptyList]);
			});
		};

		const emptyStateTests = [
			{
				description: 'shows the empty placeholder when the list is empty and idle',
				config: { propsOverrides: {} },
				expected: { isPlaceholderShown: true }
			},
			{
				description: 'hides the empty placeholder while initial loading',
				config: { propsOverrides: { isLoading: true } },
				expected: { isPlaceholderShown: false }
			},
			{
				description: 'hides the empty placeholder while refreshing',
				config: { propsOverrides: { isRefreshing: true } },
				expected: { isPlaceholderShown: false }
			},
			{
				description: 'hides the empty placeholder while a page is loading',
				config: { propsOverrides: { isPageLoading: true } },
				expected: { isPlaceholderShown: false }
			}
		];

		emptyStateTests.forEach(test => {
			runEmptyStateTest(test.description, test.config, test.expected);
		});

		it('does not show the empty placeholder when sections have data', () => {
			// Arrange & Act:
			const { tester } = createTester();

			// Assert:
			tester.notExpectText([COMPONENT_TEXT.textEmptyList]);
		});
	});

	describe('pagination', () => {
		it('calls onEndReached when the list end is reached', () => {
			// Arrange:
			const { tester, props } = createTester();

			// Act:
			tester.scrollListToEnd();

			// Assert:
			expect(props.onEndReached).toHaveBeenCalled();
		});

		const runFooterTest = (description, config, expected) => {
			it(description, () => {
				// Arrange & Act:
				const { tester } = createTester(config.propsOverrides);

				// Assert:
				if (expected.isLoadingIndicatorShown)
					tester.expectLoadingIndicator(expected.expectedIndicatorCount);
				else
					tester.notExpectLoadingIndicator();

				if (expected.isPlaceholderShown)
					tester.expectText([COMPONENT_TEXT.textPlaceholder]);
				else
					tester.notExpectText([COMPONENT_TEXT.textPlaceholder]);
			});
		};

		const renderPlaceholder = () => <Text>{COMPONENT_TEXT.textPlaceholder}</Text>;

		const footerTests = [
			{
				description: 'shows the loading footer for the enabled section while a page is loading',
				config: {
					propsOverrides: {
						isPageLoading: true,
						renderPlaceholder,
						shouldShowFooter: group => group === SECTION_GROUP_FIRST
					}
				},
				expected: { isLoadingIndicatorShown: true, expectedIndicatorCount: 1, isPlaceholderShown: true }
			},
			{
				description: 'shows no loading indicator in the footer when no page is loading',
				config: {
					propsOverrides: {
						isPageLoading: false,
						renderPlaceholder,
						shouldShowFooter: group => group === SECTION_GROUP_FIRST
					}
				},
				expected: { isLoadingIndicatorShown: false, isPlaceholderShown: true }
			},
			{
				description: 'shows no footer when shouldShowFooter returns false',
				config: {
					propsOverrides: {
						isPageLoading: true,
						renderPlaceholder,
						shouldShowFooter: () => false
					}
				},
				expected: { isLoadingIndicatorShown: false, isPlaceholderShown: false }
			},
			{
				description: 'shows no footer when shouldShowFooter is omitted',
				config: {
					propsOverrides: {
						isPageLoading: true,
						renderPlaceholder
					}
				},
				expected: { isLoadingIndicatorShown: false, isPlaceholderShown: false }
			}
		];

		footerTests.forEach(test => {
			runFooterTest(test.description, test.config, test.expected);
		});
	});

	describe('list header slot', () => {
		it('renders the custom list header above the filter when renderListHeader is provided', () => {
			// Arrange & Act:
			const { tester } = createTester({
				renderListHeader: () => <Text>{COMPONENT_TEXT.textListHeader}</Text>
			});

			// Assert:
			tester.expectText([COMPONENT_TEXT.textListHeader, COMPONENT_TEXT.textFilterBoolean]);
		});

		it('renders no custom list header when renderListHeader is omitted', () => {
			// Arrange & Act:
			const { tester } = createTester();

			// Assert:
			tester.notExpectText([COMPONENT_TEXT.textListHeader]);
		});

		it('updates the list header in place without remounting on prop identity changes', () => {
			// Arrange: probe the header subtree with a mount counter
			const onMount = jest.fn();
			const MountProbe = () => {
				React.useEffect(() => {
					onMount();
				}, []);

				return <Text>{COMPONENT_TEXT.textListHeader}</Text>;
			};
			const { tester, props } = createTester({ renderListHeader: () => <MountProbe /> });

			// Act: re-render with a new renderListHeader identity and a changed filter value
			tester.updateProps({
				...props,
				renderListHeader: () => <MountProbe />,
				filterValue: { [booleanFilter.name]: true }
			});

			// Assert: the probe mounted exactly once — the header was reconciled, not remounted
			expect(onMount).toHaveBeenCalledTimes(1);
			tester.expectText([COMPONENT_TEXT.textListHeader]);
		});
	});

	describe('screen bottom slot', () => {
		it('renders the bottom slot when renderScreenBottom is provided', () => {
			// Arrange & Act:
			const { tester } = createTester({
				renderScreenBottom: () => <Text>{COMPONENT_TEXT.textScreenBottom}</Text>
			});

			// Assert:
			tester.expectText([COMPONENT_TEXT.textScreenBottom]);
		});

		it('renders no bottom slot when renderScreenBottom is omitted', () => {
			// Arrange & Act:
			const { tester } = createTester();

			// Assert:
			tester.notExpectText([COMPONENT_TEXT.textScreenBottom]);
		});
	});

	describe('refresh', () => {
		it('calls onRefresh on the pull-to-refresh gesture', () => {
			// Arrange:
			const { tester, props } = createTester();

			// Act:
			tester.pullToRefresh();

			// Assert:
			expect(props.onRefresh).toHaveBeenCalled();
		});
	});
});
