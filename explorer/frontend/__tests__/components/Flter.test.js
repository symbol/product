import '@testing-library/jest-dom';
import 'react-intersection-observer/test-utils';
import Filter from '@/components/Filter';
import { TRANSACTION_TYPE } from '@/constants';
import * as utils from '@/utils';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@/utils', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils')
	};
});

beforeAll(() => {
	jest.spyOn(utils, 'useDebounce').mockImplementation(callback => {
		return callback;
	});
	jest.spyOn(utils, 'useDataManager').mockImplementation(callback => {
		return [callback];
	});
});

describe('Filter', () => {
	// Arrange:
	const filterConfig = [
		{
			name: 'type',
			title: 'filter_type',
			conflicts: ['mosaic', 'to'],
			type: 'transaction-type',
			options: [
				{
					type: TRANSACTION_TYPE.TRANSFER
				},
				{
					type: TRANSACTION_TYPE.NAMESPACE_REGISTRATION
				}
			]
		},
		{
			name: 'from',
			title: 'filter_from',
			type: 'account',
			conflicts: [],
			isSearchEnabled: true,
			options: []
		},
		{
			name: 'to',
			title: 'filter_to',
			type: 'account',
			conflicts: ['type'],
			isSearchEnabled: false,
			options: []
		},
		{
			name: 'mosaic',
			title: 'filter_mosaic',
			type: 'mosaic',
			conflicts: ['type'],
			isSearchEnabled: true
		},
		{
			name: 'height',
			title: 'filter_block',
			type: 'block',
			conflicts: [],
			isSearchEnabled: true
		},
		{
			name: 'boolean1',
			title: 'boolean1',
			off: ['boolean2'],
			conflicts: ['boolean3'],
			type: 'boolean'
		},
		{
			name: 'boolean2',
			title: 'boolean2',
			conflicts: ['boolean3'],
			off: ['boolean1'],
			type: 'boolean'
		},
		{
			name: 'boolean3',
			title: 'boolean3',
			type: 'boolean',
			conflicts: ['boolean1', 'boolean2'],
			isSearchEnabled: true
		}
	];

	describe('filter buttons appearance', () => {
		const runButtonTest = async (filter, isDisabled, expectedSelectedFilters, expectedDisabledFilters) => {
			// Arrange:
			const changeFilter = jest.fn();
			const search = jest.fn();

			// Act:
			render(
				<Filter
					isSelectedItemsShown
					data={filterConfig}
					isDisabled={isDisabled}
					value={filter}
					onChange={changeFilter}
					search={search}
				/>
			);

			// Assert:
			const buttons = screen.getAllByRole('button').slice(1);
			expect(buttons).toHaveLength(filterConfig.length);
			buttons.forEach((button, index) => {
				const filterName = filterConfig[index].name;
				expect(button).toHaveAttribute('aria-selected', expectedSelectedFilters.includes(filterName).toString());
				expect(button).toHaveAttribute('aria-disabled', expectedDisabledFilters.includes(filterName).toString());
			});
		};

		it('renders buttons when no filter is selected', async () => {
			// Assert:
			const filter = {};
			const isDisabled = false;
			const expectedSelectedFilters = [];
			const expectedDisabledFilters = [];

			// Act + Assert:
			await runButtonTest(filter, isDisabled, expectedSelectedFilters, expectedDisabledFilters);
		});

		it('renders buttons when some filters are selected', async () => {
			// Assert:
			const filter = {
				from: 'from-account-address',
				to: 'to-account-address'
			};
			const isDisabled = false;
			const expectedSelectedFilters = ['from', 'to'];
			const expectedDisabledFilters = ['type'];

			// Act + Assert:
			await runButtonTest(filter, isDisabled, expectedSelectedFilters, expectedDisabledFilters);
		});

		it('renders buttons when isDisabled is true', async () => {
			// Assert:
			const filter = {};
			const isDisabled = true;
			const expectedSelectedFilters = [];
			const expectedDisabledFilters = filterConfig.map(filter => filter.name);

			// Act + Assert:
			await runButtonTest(filter, isDisabled, expectedSelectedFilters, expectedDisabledFilters);
		});
	});

	describe('filter selection', () => {
		const runSelectionTest = async (filter, filterToPress, expectedFilter, shouldChangeFilter) => {
			// Arrange:
			const changeFilter = jest.fn();
			const search = jest.fn();

			// Act:
			render(
				<Filter
					isSelectedItemsShown
					data={filterConfig}
					isDisabled={false}
					value={filter}
					onChange={changeFilter}
					search={search}
				/>
			);

			// Act:
			const button = screen.getByRole('button', { name: filterToPress });
			fireEvent.click(button);

			// Assert:
			if (shouldChangeFilter) {
				expect(changeFilter).toHaveBeenCalledTimes(1);
				expect(changeFilter).toHaveBeenCalledWith(expectedFilter);
			} else {
				expect(changeFilter).toHaveBeenCalledTimes(0);
			}
		};

		it('selects a filter', async () => {
			// Assert:
			const filter = {};
			const filterToPress = 'boolean1';
			const expectedFilter = { boolean1: true };
			const shouldChangeFilter = true;

			// Act + Assert:
			await runSelectionTest(filter, filterToPress, expectedFilter, shouldChangeFilter);
		});

		it('selects a filter and deselects initial', async () => {
			// Assert:
			const filter = { boolean1: true };
			const filterToPress = 'boolean2';
			const expectedFilter = { boolean2: true };
			const shouldChangeFilter = true;

			// Act + Assert:
			await runSelectionTest(filter, filterToPress, expectedFilter, shouldChangeFilter);
		});

		it('deselects a filter', async () => {
			// Assert:
			const filter = { boolean1: true };
			const filterToPress = 'boolean1';
			const expectedFilter = {};
			const shouldChangeFilter = true;

			// Act + Assert:
			await runSelectionTest(filter, filterToPress, expectedFilter, shouldChangeFilter);
		});

		it('disables conflicting filter', async () => {
			// Assert:
			const filter = { boolean1: true };
			const filterToPress = 'boolean3';
			const expectedFilter = { boolean1: true };
			const shouldChangeFilter = false;

			// Act + Assert:
			await runSelectionTest(filter, filterToPress, expectedFilter, shouldChangeFilter);
		});

		it('clears selected filters', async () => {
			// Assert:
			const filter = { boolean1: true };
			const filterToPress = 'button_clear';
			const expectedFilter = {};
			const shouldChangeFilter = true;

			// Act + Assert:
			await runSelectionTest(filter, filterToPress, expectedFilter, shouldChangeFilter);
		});
	});

	describe('filter options', () => {
		const runFilterOptionsTest = async (searchResponse, filterToPress, shouldUseSearch, expectedTextList) => {
			// Arrange:
			const changeFilter = jest.fn();
			const search = jest.fn().mockResolvedValue(searchResponse);
			const searchText = 'search-text-value';

			// Act:
			render(
				<Filter isSelectedItemsShown data={filterConfig} isDisabled={false} value={{}} onChange={changeFilter} search={search} />
			);

			// Act:
			const button = screen.getByRole('button', { name: filterToPress });
			fireEvent.click(button);
			await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
			if (shouldUseSearch) {
				const searchBoxInput = screen.getByRole('searchbox');
				fireEvent.change(searchBoxInput, { target: { value: searchText } });
				await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
			}

			// Assert:
			if (shouldUseSearch) {
				expect(search).toHaveBeenCalledWith(searchText);
			}
			const assertionPromises = expectedTextList.map(text => {
				return waitFor(() => expect(screen.getByText(text)).toBeInTheDocument());
			});
			await Promise.all(assertionPromises);

			// Act:
			const option = screen.getByText(expectedTextList[0]);
			fireEvent.click(option);
			await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

			// Assert:
			expect(screen.getByText(expectedTextList[0])).toBeInTheDocument();
		};

		it('renders mosaic options', async () => {
			// Assert:
			const shouldUseSearch = true;
			const filterToPress = 'filter_mosaic';
			const expectedTextList = ['mosaic.name'];
			const searchResponse = {
				mosaic: {
					name: 'mosaic.name',
					id: 'mosaic-id'
				},
				namespace: {
					name: 'mosaic.name',
					id: 'namespace-id'
				}
			};

			// Act + Assert:
			await runFilterOptionsTest(searchResponse, filterToPress, shouldUseSearch, expectedTextList);
		});

		it('renders account options', async () => {
			// Assert:
			const shouldUseSearch = true;
			const filterToPress = 'filter_from';
			const expectedTextList = ['account-address'];
			const searchResponse = {
				account: {
					address: 'account-address'
				}
			};

			// Act + Assert:
			await runFilterOptionsTest(searchResponse, filterToPress, shouldUseSearch, expectedTextList);
		});

		it('renders block options', async () => {
			// Assert:
			const shouldUseSearch = true;
			const timestamp = new Date().toISOString();
			const height = '123456789';
			const filterToPress = 'filter_block';
			const expectedTextList = [height];
			const searchResponse = {
				block: {
					height,
					timestamp
				}
			};

			// Act + Assert:
			await runFilterOptionsTest(searchResponse, filterToPress, shouldUseSearch, expectedTextList);
		});

		it('renders transaction type options', async () => {
			// Assert:
			const shouldUseSearch = false;
			const filterToPress = 'filter_type';
			const expectedTextList = [
				`transactionType_${TRANSACTION_TYPE.TRANSFER}`,
				`transactionType_${TRANSACTION_TYPE.NAMESPACE_REGISTRATION}`
			];
			const searchResponse = null;

			// Act + Assert:
			await runFilterOptionsTest(searchResponse, filterToPress, shouldUseSearch, expectedTextList);
		});
	});
});
