import Completed from './';
import Helper from '../../utils/helper';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockCompletedAPIFetch = (response, mocker = fetch.mockResponseOnce) =>
	mocker(JSON.stringify(response));

beforeEach(() => {
	fetch.resetMocks();
});

describe('Completed', () => {
	const expectedNemAddress = 'NACCHQECDSB7F5YXVD4PE6YZZQLU5VGTUHODWBBQ';
	const expectedNemAddress2 = 'NBMGTHTMS56FK7YZC3IQDXWO54AYGALHFTFMXS6K';
	const expectedSymbolAddress = 'NBR5FD65S36PR6YDE4KZAIV7GW7AJPW25J7FNCA';
	const expectedSymbolAddress2 = 'NAUCJ7RIZXXRDQHZTYHTXI77LEWTMPHL5RQ3HQI';
	const expectedTransactionHash = 'E056DC9C5343B12078210B059D84999906A29982B35E313CB16924549A4D6E07';
	const expectedTransactionHash2 = '1C09091146550A873040219CABDEB0F732A3FC5F256E3B0930646E66F6CE3A28';
	const expectedOptinType = 'PRE';
	const expectedOptinType2 = 'POST';
	const expectedSymbolTimestamp = 1615853185;
	const expectedSymbolTimestamp2 = 1622028233.132;
	const expectedNemTimestamp = '1635273519';
	const expectedNemTimestamp2 = '1635289962';
	const generateCompletedResponse = (data, pageNumber, pageSize, totalRecord) => {
		return {
			data,
			pagination: {
				pageNumber,
				pageSize,
				totalRecord
			}
		};
	};
	const generateRowData = ({nemAddress = expectedNemAddress, symbolAddress = expectedSymbolAddress,
		transactionHash = expectedTransactionHash, isPostoptin = 0, nemTimestamp = expectedNemTimestamp,
		symbolTimestamp = expectedSymbolTimestamp}) => {
		return {
			optinId: 26007,
			isPostoptin,
			label: [
				'Bittrex'
			],
			nemAddress: [
				nemAddress
			],
			nemBalance: [
				7600000
			],
			nemHeights: [
				'3170443'
			],
			nemHashes: [
				'663FF7F8FCD97F8853D302DFA35F2E8AE63BE262BD987A719452D7ED69DAEE97'
			],
			nemTimestamps: [
				nemTimestamp
			],
			symbolAddress: [
				symbolAddress
			],
			symbolHeights: [
				202885
			],
			symbolHashes: [
				transactionHash
			],
			symbolTimestamps: [
				symbolTimestamp
			],
			symbolBalance: [
				7600000
			]
		};

	};
	const testFilterSort = async (
		firstRowData, secondRowData, expectedTextForFirstRow, expectedTextForSecondRow,
		selectorMatcherOptions, filterActionAndAssertions, isSort = false
	) => {
		// Arrange:
		mockCompletedAPIFetch(generateCompletedResponse([firstRowData, secondRowData], 1, 1, 2));

		render(<Completed />);

		// Waiting for the data to load
		expect((await screen.findAllByText(expectedTextForFirstRow, selectorMatcherOptions))[0]).toBeInTheDocument();
		expect((await screen.findAllByText(expectedTextForSecondRow, selectorMatcherOptions))[0]).toBeInTheDocument();

		// Act:
		await filterActionAndAssertions();

		// Assert:
		expect((await screen.findAllByText(expectedTextForFirstRow, selectorMatcherOptions))[0]).toBeInTheDocument();
		if (isSort)
			expect((await screen.findAllByText(expectedTextForSecondRow, selectorMatcherOptions))[0]).toBeInTheDocument();
		else
			expect(screen.queryByText(expectedTextForSecondRow, selectorMatcherOptions)).not.toBeInTheDocument();
	};

	describe('Rendering', () => {
		it('should render completed page when API response data is empty', async () => {
			// Arrange:
			mockCompletedAPIFetch(generateCompletedResponse([], 0, 0, 0));

			// Act:
			render(<Completed />);

			expect(await screen.findByText('NEM Address')).toBeInTheDocument();
		});

		it('should render completed page when API response data is not empty', async () => {
			// Arrange:
			mockCompletedAPIFetch(generateCompletedResponse([generateRowData({})], 1, 1, 1));

			// Act:
			render(<Completed />);

			expect(await screen.findByText('NEM Address')).toBeInTheDocument();
			expect((await screen.findAllByText(expectedNemAddress))[0]).toBeInTheDocument();
		});

		it('should render completed page when response data is not empty and page number is greater than 1', async () => {
			// Arrange:
			// set initial API response
			mockCompletedAPIFetch(generateCompletedResponse(Helper.fillArray(200, generateRowData({})), 1, 20, 200));

			render(<Completed />);

			// Part of arrange, waiting for the first page to load
			expect((await screen.findAllByText(expectedNemAddress))[0]).toBeInTheDocument();

			// set second API response
			mockCompletedAPIFetch(generateCompletedResponse(Helper.fillArray(
				200,
				generateRowData({nemAddress: expectedNemAddress2})
			), 2, 20, 200), fetch.mockResponse);

			// eslint-disable-next-line testing-library/no-node-access
			const scrollContainer = document.querySelector('.p-datatable-wrapper');

			// Act:
			fireEvent.scroll(scrollContainer, { target: { scrollY: 1000} });

			// Assert:
			expect((await screen.findAllByText(expectedNemAddress2))[0]).toBeInTheDocument();
		}, 60000);
	});

	describe('Filtering', () => {
		const testFilterSearchWithValidInput = async (firstRowData, secondRowData, expectedTextForFirstRow, expectedTextForSecondRow) => {
			const filterActionAndAssertions = async () => {
				// Arrange:
				const filterSearchInput = screen.getByPlaceholderText('NEM Address / Symbol Address / Tx Hash');
				const completedAPIResponseFiltered = generateCompletedResponse([firstRowData]);
				mockCompletedAPIFetch(completedAPIResponseFiltered);

				// Act:
				await userEvent.type(filterSearchInput, `${expectedTextForFirstRow}{enter}`);

				// Assert:
				expect(filterSearchInput).toHaveDisplayValue(expectedTextForFirstRow);
			};
			await testFilterSort(
				firstRowData, secondRowData, expectedTextForFirstRow, expectedTextForSecondRow,
				{exact: false}, filterActionAndAssertions
			);
		};

		it('should filter search by nem address', async () => {
			await testFilterSearchWithValidInput(
				generateRowData({nemAddress: expectedNemAddress}), generateRowData({nemAddress: expectedNemAddress2}),
				expectedNemAddress, expectedNemAddress2
			);
		});

		it('should filter search by symbol address', async () => {
			await testFilterSearchWithValidInput(
				generateRowData({symbolAddress: expectedSymbolAddress}), generateRowData({symbolAddress: expectedSymbolAddress2}),
				expectedSymbolAddress, expectedSymbolAddress2
			);
		});

		it('should filter search by transaction hash', async () => {
			await testFilterSearchWithValidInput(
				generateRowData({transactionHash: expectedTransactionHash}), generateRowData({transactionHash: expectedTransactionHash2}),
				expectedTransactionHash, expectedTransactionHash2
			);
		});

		const testFilterSearchWithInvalidInput = async invalidFilterText => {
			// Arrange:
			const completedAPIResponse = generateCompletedResponse([], 0, 0, 0);
			mockCompletedAPIFetch(completedAPIResponse);

			render(<Completed />);

			const filterSearchInput = screen.getByPlaceholderText('NEM Address / Symbol Address / Tx Hash');

			// Act:
			await userEvent.type(filterSearchInput, `${invalidFilterText}`);

			// Assert:
			expect((await screen.findAllByText('Invalid NEM / Symbol Address or Transaction Hash.'))[0]).toBeInTheDocument();
		};

		const invalidateText = text => text.substring(0, text.length - 2);

		it('should filter search by invalid nem address', async () => {
			await testFilterSearchWithInvalidInput(invalidateText(expectedNemAddress));
		});

		it('should filter search by invalid symbol address', async () => {
			await testFilterSearchWithInvalidInput(invalidateText(expectedSymbolAddress));
		});

		it('should filter search by invalid transaction hash', async () => {
			await testFilterSearchWithInvalidInput(invalidateText(expectedTransactionHash));
		});

		it('should clear search input and reset search when clear button is clicked', async () => {
			// Arrange:
			const completedAPIResponse = generateCompletedResponse([generateRowData({nemAddress: expectedNemAddress})], 1, 1, 1);
			mockCompletedAPIFetch(completedAPIResponse);

			render(<Completed />);

			// Waiting for the page to load
			expect((await screen.findAllByText(expectedNemAddress))[0]).toBeInTheDocument();

			const completedAPIResponseFilterReset =
				generateCompletedResponse([generateRowData({nemAddress: expectedNemAddress2})], 1, 1, 1);
			mockCompletedAPIFetch(completedAPIResponseFilterReset);

			// Act:
			fireEvent.click(screen.getByRole('button', {name: 'Clear'}));

			// Assert:
			expect(await screen.findByPlaceholderText('NEM Address / Symbol Address / Tx Hash')).toHaveDisplayValue('');
			expect((await screen.findAllByText(expectedNemAddress2))[0]).toBeInTheDocument();
			await waitFor(() => expect(screen.queryByText(expectedNemAddress)).not.toBeInTheDocument());
		});

		const testFilterByOptinType = async (firstRowData, secondRowData, expectedTextForFirstRow, expectedTextForSecondRow) => {
			const filterActionAndAssertions = async () => {
				// Arrange:
				const filterOptinType = await screen.findByRole('button', {name: expectedTextForFirstRow});
				const completedAPIResponseFiltered = generateCompletedResponse([firstRowData]);
				mockCompletedAPIFetch(completedAPIResponseFiltered);

				// Act:
				await userEvent.click(filterOptinType);
			};
			await testFilterSort(
				firstRowData, secondRowData, expectedTextForFirstRow, expectedTextForSecondRow,
				{selector: '.p-badge'}, filterActionAndAssertions
			);
		};

		it('should filter by optin type pre', async () => {
			await testFilterByOptinType(
				generateRowData({isPostoptin: 0}), generateRowData({isPostoptin: 1}),
				expectedOptinType, expectedOptinType2
			);
		});

		it('should filter by optin type post', async () => {
			await testFilterByOptinType(
				generateRowData({isPostoptin: 1}), generateRowData({isPostoptin: 0}),
				expectedOptinType2, expectedOptinType
			);
		});

	});

	describe('Sorting', () => {
		const testSortByHeader = async (
			headerTitle, headerInx, firstRowData, secondRowData, expectedTextForFirstRow,
			expectedTextForSecondRow
		) => {
			const filterActionAndAssertions = async () => {
				// Arrange:
				const sortableColumnHeader = (await screen.findAllByRole('button', {name: headerTitle }))[headerInx];
				const completedAPIResponseSorted = generateCompletedResponse([secondRowData, firstRowData]);
				mockCompletedAPIFetch(completedAPIResponseSorted);

				// Act:
				await userEvent.click(sortableColumnHeader);
			};
			await testFilterSort(
				firstRowData, secondRowData, expectedTextForFirstRow, expectedTextForSecondRow,
				{exact: false}, filterActionAndAssertions, true
			);
		};

		it('should sort by nem transaction date and hash', async () => {
			await testSortByHeader(
				'Hash', 0,
				generateRowData({nemTimestamp: expectedNemTimestamp}), generateRowData({nemTimestamp: expectedNemTimestamp2}),
				Helper.convertTimestampToDate(expectedNemTimestamp, Helper.getLocalTimezone()),
				Helper.convertTimestampToDate(expectedNemTimestamp2, Helper.getLocalTimezone())
			);
		});

		it('should sort by symbol transaction date and hash', async () => {
			await testSortByHeader(
				'Hash', 1,
				generateRowData({symbolTimestamp: expectedSymbolTimestamp}),
				generateRowData({symbolTimestamp: expectedSymbolTimestamp2}),
				Helper.convertTimestampToDate(expectedSymbolTimestamp, Helper.getLocalTimezone()),
				Helper.convertTimestampToDate(expectedSymbolTimestamp2, Helper.getLocalTimezone())
			);
		});
	});
});
