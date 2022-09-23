import Requests from './';
import Helper from '../../utils/helper';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockRequestsAPIFetch = (response, mocker = fetch.mockResponseOnce) =>
	mocker(JSON.stringify(response));

beforeEach(() => {
	fetch.resetMocks();
});

describe('Requests', () => {
	const expectedNemAddress = 'NACCHQECDSB7F5YXVD4PE6YZZQLU5VGTUHODWBBQ';
	const expectedNemAddress2 = 'NBMGTHTMS56FK7YZC3IQDXWO54AYGALHFTFMXS6K';
	const expectedTransactionHash = 'E056DC9C5343B12078210B059D84999906A29982B35E313CB16924549A4D6E07';
	const expectedTransactionHash2 = '1C09091146550A873040219CABDEB0F732A3FC5F256E3B0930646E66F6CE3A28';
	const expectedNemTimestamp = '1635273519';
	const expectedNemTimestamp2 = '1635289962';
	const expectedSymbolTimestamp = 1615853185;
	const expectedSymbolTimestamp2 = 1622028233.132;
	const expectedStatus = 'Sent';
	const expectedStatus2 = 'Error';
	const expectedStatus3 = 'Duplicate';
	const expectedStatus4 = 'Pending';
	const generateRequestsResponse = (data, pageNumber, pageSize, totalRecord) => {
		return {
			data,
			pagination: {
				pageNumber,
				pageSize,
				totalRecord
			}
		};
	};
	const generateRowData = ({nemAddress = expectedNemAddress, transactionHash = expectedTransactionHash,
		status = expectedStatus, nemTimestamp = expectedNemTimestamp, symbolTimestamp = expectedSymbolTimestamp}) => {
		return {
			optinTransactionHeight: 3702180,
			nemAddress: nemAddress,
			optinTransactionHash: transactionHash,
			payoutTransactionHeight: 1189341,
			payoutTransactionHash: 'a97f8108a60197869749ee2525f2740959fbc1d790861a4eab77161e77b05252',
			status: status,
			message: null,
			optinTimestamp: nemTimestamp,
			payoutTimestamp: symbolTimestamp
		};
	};
	const testFilterSort = async (
		firstRowData, secondRowData, expectedTextForFirstRow, expectedTextForSecondRow,
		selectorMatcherOptions, filterActionAndAssertions, isSort = false
	) => {
		// Arrange:
		mockRequestsAPIFetch(generateRequestsResponse([firstRowData, secondRowData], 1, 1, 2));

		render(<Requests />);

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
		it('should render in progress page when API response data is empty', async () => {
			// Arrange:
			mockRequestsAPIFetch(generateRequestsResponse([], 0, 0, 0));

			// Act:
			render(<Requests />);

			expect(await screen.findByText('NEM Address')).toBeInTheDocument();
		});

		it('should render in progress page when API response data is not empty', async () => {
			// Arrange:
			mockRequestsAPIFetch(generateRequestsResponse([generateRowData({})], 1, 1, 1));

			// Act:
			render(<Requests />);

			expect(await screen.findByText('NEM Address')).toBeInTheDocument();
			expect((await screen.findAllByText(expectedNemAddress))[0]).toBeInTheDocument();
		});

		it('should render in progress page when response data is not empty and page number is greater than 1', async () => {
			// Arrange:
			// set initial API response
			mockRequestsAPIFetch(generateRequestsResponse(Helper.fillArray(200, generateRowData({})), 1, 20, 200));

			render(<Requests />);

			// Part of arrange, waiting for the first page to load
			expect((await screen.findAllByText(expectedNemAddress))[0]).toBeInTheDocument();

			// set second API response
			mockRequestsAPIFetch(generateRequestsResponse(Helper.fillArray(
				200,
				generateRowData({nemAddress: expectedNemAddress2})
			), 2, 20, 200), fetch.mockResponse);

			// eslint-disable-next-line testing-library/no-node-access
			const scrollContainer = document.querySelector('.p-datatable-wrapper');

			// Act:
			fireEvent.scroll(scrollContainer, { target: { scrollY: 1000} });

			// Assert:
			expect((await screen.findAllByText(expectedNemAddress2))[0]).toBeInTheDocument();
		}, 20000);
	});

	describe('Filtering', () => {
		const testFilterSearchWithValidInput = async (firstRowData, secondRowData, expectedTextForFirstRow, expectedTextForSecondRow) => {
			const filterActionAndAssertions = async () => {
				// Arrange:
				const filterSearchInput = screen.getByPlaceholderText('NEM Address / Tx Hash');
				const requestsAPIResponseFiltered = generateRequestsResponse([firstRowData]);
				mockRequestsAPIFetch(requestsAPIResponseFiltered);

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

		it('should filter search by transaction hash', async () => {
			await testFilterSearchWithValidInput(
				generateRowData({transactionHash: expectedTransactionHash}), generateRowData({transactionHash: expectedTransactionHash2}),
				expectedTransactionHash, expectedTransactionHash2
			);
		});

		const testFilterSearchWithInvalidInput = async invalidFilterText => {
			// Arrange:
			const requestsAPIResponse = generateRequestsResponse([], 0, 0, 0);
			mockRequestsAPIFetch(requestsAPIResponse);

			render(<Requests />);

			const filterSearchInput = screen.getByPlaceholderText('NEM Address / Tx Hash');

			// Act:
			await userEvent.type(filterSearchInput, `${invalidFilterText}`);

			// Assert:
			expect((await screen.findAllByText('Invalid NEM Address or Transaction Hash.'))[0]).toBeInTheDocument();
		};

		const invalidateText = text => text.substring(0, text.length - 2);

		it('should filter search by invalid nem address', async () => {
			await testFilterSearchWithInvalidInput(invalidateText(expectedNemAddress));
		});

		it('should filter search by invalid transaction hash', async () => {
			await testFilterSearchWithInvalidInput(invalidateText(expectedTransactionHash));
		});

		it('should clear search input and reset search when clear button is clicked', async () => {
			// Arrange:
			const requestsAPIResponse = generateRequestsResponse([generateRowData({nemAddress: expectedNemAddress})], 1, 1, 1);
			mockRequestsAPIFetch(requestsAPIResponse);

			render(<Requests />);

			// Waiting for the page to load
			expect((await screen.findAllByText(expectedNemAddress))[0]).toBeInTheDocument();

			const requestsAPIResponseFilterReset = generateRequestsResponse([generateRowData({nemAddress: expectedNemAddress2})], 1, 1, 1);
			mockRequestsAPIFetch(requestsAPIResponseFilterReset);

			// Act:
			fireEvent.click(screen.getByRole('button', {name: 'Clear'}));

			// Assert:
			expect(await screen.findByPlaceholderText('NEM Address / Tx Hash')).toHaveDisplayValue('');
			expect((await screen.findAllByText(expectedNemAddress2))[0]).toBeInTheDocument();
			await waitFor(() => expect(screen.queryByText(expectedNemAddress)).not.toBeInTheDocument());
		});

		const testFilterByStatus = async (
			firstRowData, secondRowData, expectedTextForFirstRow,
			expectedTextForSecondRow, statusButtonText
		) => {
			const filterActionAndAssertions = async () => {
			// Arrange:
				const filterStatus = await screen.findByRole('button', {name: statusButtonText});
				const requestsAPIResponseFiltered = generateRequestsResponse([firstRowData]);
				mockRequestsAPIFetch(requestsAPIResponseFiltered);

				// Act:
				await userEvent.click(filterStatus);
			};
			await testFilterSort(
				firstRowData, secondRowData, expectedTextForFirstRow, expectedTextForSecondRow,
				{selector: '.p-badge'}, filterActionAndAssertions
			);
		};

		it('should filter by status sent', async () => {
			await testFilterByStatus(
				generateRowData({status: 'Sent'}), generateRowData({status: 'Error'}),
				expectedStatus, expectedStatus2, 'Sent'
			);
		});

		it('should filter by status error', async () => {
			await testFilterByStatus(
				generateRowData({status: 'Error'}), generateRowData({status: 'Sent'}),
				expectedStatus2, expectedStatus, 'Err'
			);
		});

		it('should filter by status duplicate', async () => {
			await testFilterByStatus(
				generateRowData({status: 'Duplicate'}), generateRowData({status: 'Sent'}),
				expectedStatus3, expectedStatus, 'Dup'
			);
		});

		it('should filter by status pending', async () => {
			await testFilterByStatus(
				generateRowData({status: 'Pending'}), generateRowData({status: 'Sent'}),
				expectedStatus4, expectedStatus, 'Pend'
			);
		});
	});

	describe('Sorting', () => {
		const testSortByHeader = async (
			headerTitle, headerInx, firstRowData, secondRowData,
			expectedTextForFirstRow, expectedTextForSecondRow
		) => {
			const filterActionAndAssertions = async () => {
			// Arrange:
				const sortableColumnHeader = (await screen.findAllByRole('button', {name: headerTitle }))[headerInx];
				const requestsAPIResponseSorted = generateRequestsResponse([secondRowData, firstRowData]);
				mockRequestsAPIFetch(requestsAPIResponseSorted);

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
				'Opt-in Hash', 0,
				generateRowData({nemTimestamp: expectedNemTimestamp}), generateRowData({nemTimestamp: expectedNemTimestamp2}),
				Helper.convertTimestampToDate(expectedNemTimestamp, Helper.getLocalTimezone()),
				Helper.convertTimestampToDate(expectedNemTimestamp2, Helper.getLocalTimezone())
			);
		});

		it('should sort by symbol transaction date and hash', async () => {
			await testSortByHeader(
				'Payout Hash', 1,
				generateRowData({symbolTimestamp: expectedSymbolTimestamp}),
				generateRowData({symbolTimestamp: expectedSymbolTimestamp2}),
				Helper.convertTimestampToDate(expectedSymbolTimestamp, Helper.getLocalTimezone()),
				Helper.convertTimestampToDate(expectedSymbolTimestamp2, Helper.getLocalTimezone())
			);
		});
	});
});
