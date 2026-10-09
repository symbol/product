import '@testing-library/jest-dom';
import { cosignatoryAccount } from '../../__fixtures__/local/account';
import { transactionListConfirmed } from '../../__fixtures__/local/transaction-list-confirmed';
import { transactionStats } from '../../__fixtures__/local/transaction-stats';
import {
	runGetServerSidePropsTests,
	runRenderScenarioTests,
	runSearchCriteriaTests,
	runTableErrorTest,
	selectFilterOption,
	toggleFilterChip
} from '../test-utils/page';
import * as StatsService from '@/app/api/stats';
import * as TransactionService from '@/app/api/transactions';
import { STORAGE_KEY, TRANSACTION_TYPE } from '@/app/constants';
import TransactionList, { getServerSideProps } from '@/app/pages/transactions';
import { truncateString } from '@/app/utils';
import { render } from '@testing-library/react';

// Mocks

jest.mock('@/app/api/transactions', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/transactions')
	};
});

jest.mock('@/app/api/stats', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/stats')
	};
});

beforeEach(() => {
	jest.spyOn(TransactionService, 'fetchTransactionPage').mockResolvedValue(emptyPage);
	jest.spyOn(StatsService, 'fetchTransactionChart').mockResolvedValue([]);
});

// Constants

const SCREEN_TEXT = {
	sectionTransactions: 'section_transactions',
	fieldTransactionsAll: 'field_transactionsAll',
	fieldTransactions30Days: 'field_transactions30Days',
	fieldTransactions24Hours: 'field_transactions24Hours',
	fieldTransactionsPerBlockShort: 'field_transactionsPerBlockShort',
	fieldTransactions: 'field_transactions',
	filterPerDay: 'filter_perDay',
	filterPerMonth: 'filter_perMonth',
	filterType: 'filter_type',
	filterFrom: 'filter_from',
	filterTo: 'filter_to',
	buttonCsv: 'button_csv',
	messageEmptyTable: 'message_emptyTable',
	tableFieldHash: 'table_field_hash',
	tableFieldType: 'table_field_type',
	tableFieldSender: 'table_field_sender',
	tableFieldRecipient: 'table_field_recipient',
	tableFieldValue: 'table_field_value',
	tableFieldFee: 'table_field_fee',
	typeTransfer: 'transactionType_TRANSFER'
};

const mockedChartText = 'Mocked React ApexCharts';
const totalTransactionsShortText = '4.51K';
const contact = {
	address: cosignatoryAccount.address,
	name: 'Cosignatory'
};
const contactOptionText = 'Cosignatory (...4VD)';
const transactionHashTexts = transactionListConfirmed.map(transaction => truncateString(transaction.hash, 'hash'));
const blockHeights = [...new Set(transactionListConfirmed.map(transaction => transaction.height))];
const transferTransactions = transactionListConfirmed.filter(transaction => transaction.type === TRANSACTION_TYPE.TRANSFER);
const nonTransferTransactions = transactionListConfirmed.filter(transaction => transaction.type !== TRANSACTION_TYPE.TRANSFER);
const transactionPage = {
	data: transactionListConfirmed,
	pageNumber: 1
};
const transferTransactionPage = {
	data: transferTransactions,
	pageNumber: 1
};
const emptyPage = {
	data: [],
	pageNumber: 1
};

// Tests

describe('TransactionList', () => {
	describe('getServerSideProps', () => {
		const requests = {
			transactionPage: [TransactionService, 'fetchTransactionPage'],
			transactionStats: [StatsService, 'fetchTransactionStats']
		};

		const getServerSidePropsCases = [
			{
				description: 'returns the preloaded transactions and the transaction stats props',
				config: {
					responses: {
						transactionPage,
						transactionStats
					}
				},
				expected: {
					requestArguments: {
						transactionPage: [],
						transactionStats: []
					},
					result: {
						props: {
							preloadedData: transactionListConfirmed,
							stats: transactionStats
						}
					}
				}
			}
		];

		runGetServerSidePropsTests({
			getServerSideProps,
			requests,
			cases: getServerSidePropsCases
		});
	});

	describe('render', () => {
		const renderPage = config => {
			localStorage.setItem(STORAGE_KEY.ADDRESS_BOOK, JSON.stringify(config.contacts ?? []));
			if (config.transactionPage)
				TransactionService.fetchTransactionPage.mockResolvedValue(config.transactionPage);
			render(<TransactionList preloadedData={config.preloadedData} stats={transactionStats} />);
		};

		const renderFilteredPage = async () => {
			renderPage({ preloadedData: transactionListConfirmed });
			await selectFilterOption(SCREEN_TEXT.filterType, SCREEN_TEXT.typeTransfer)();
		};

		describe('section: transactions', () => {
			const transactionsCases = [
				{
					description: 'renders the transaction stats',
					config: { preloadedData: transactionListConfirmed },
					expected: {
						texts: [
							SCREEN_TEXT.sectionTransactions,
							SCREEN_TEXT.fieldTransactionsAll,
							totalTransactionsShortText,
							SCREEN_TEXT.fieldTransactions30Days,
							SCREEN_TEXT.fieldTransactions24Hours,
							SCREEN_TEXT.fieldTransactionsPerBlockShort,
							transactionStats.averagePerBlock
						],
						titles: [
							transactionStats.total,
							transactionStats.last30Days,
							transactionStats.last24Hours
						]
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: transactionsCases });
		});

		describe('transaction chart', () => {
			const toggleDailyChartFilter = toggleFilterChip(SCREEN_TEXT.filterPerDay);
			const toggleMonthlyChartFilter = toggleFilterChip(SCREEN_TEXT.filterPerMonth);

			const chartCases = [
				{
					description: 'renders the chart',
					config: { preloadedData: transactionListConfirmed },
					expected: {
						texts: [SCREEN_TEXT.fieldTransactions],
						asyncTexts: [mockedChartText]
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: chartCases });

			const chartSearchCriteriaCases = [
				{
					description: 'requests the block chart by default',
					config: {
						preloadedData: transactionListConfirmed,
						actions: []
					},
					expected: { searchCriteria: {} }
				},
				{
					description: 'requests the daily chart when the per day filter is selected',
					config: {
						preloadedData: transactionListConfirmed,
						actions: [toggleDailyChartFilter]
					},
					expected: { searchCriteria: { isPerDay: true } }
				},
				{
					description: 'requests the monthly chart when the per month filter is selected',
					config: {
						preloadedData: transactionListConfirmed,
						actions: [toggleDailyChartFilter, toggleMonthlyChartFilter]
					},
					expected: { searchCriteria: { isPerMonth: true } }
				}
			];

			runSearchCriteriaTests({
				renderPage,
				request: [StatsService, 'fetchTransactionChart'],
				cases: chartSearchCriteriaCases
			});
		});

		describe('transaction table', () => {
			const transactionTableCases = [
				{
					description: 'renders the table headers, the transactions grouped by block and the CSV button',
					config: { preloadedData: transactionListConfirmed },
					expected: {
						texts: [
							SCREEN_TEXT.buttonCsv,
							SCREEN_TEXT.tableFieldHash,
							SCREEN_TEXT.tableFieldType,
							SCREEN_TEXT.tableFieldSender,
							SCREEN_TEXT.tableFieldRecipient,
							SCREEN_TEXT.tableFieldValue,
							SCREEN_TEXT.tableFieldFee,
							// Each block header is rendered once, also for a block with several transactions.
							...blockHeights,
							...transactionHashTexts
						]
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: transactionTableCases });

			runTableErrorTest('renders the try-again action when the transaction request fails', {
				renderPage: renderFilteredPage,
				request: [TransactionService, 'fetchTransactionPage']
			});
		});

		describe('transaction filter', () => {
			const selectTransferType = selectFilterOption(SCREEN_TEXT.filterType, SCREEN_TEXT.typeTransfer);
			const selectFromContact = selectFilterOption(SCREEN_TEXT.filterFrom, contactOptionText);
			const selectToContact = selectFilterOption(SCREEN_TEXT.filterTo, contactOptionText);

			const filterCases = [
				{
					description: 'renders the filtered transactions when the type filter is selected',
					config: {
						preloadedData: transactionListConfirmed,
						transactionPage: transferTransactionPage,
						actions: [selectTransferType]
					},
					expected: {
						asyncTexts: transferTransactions.map(transaction => truncateString(transaction.hash, 'hash')),
						hiddenTexts: nonTransferTransactions.map(transaction => truncateString(transaction.hash, 'hash'))
					}
				},
				{
					description: 'renders the empty message when no transaction matches the filter',
					config: {
						preloadedData: transactionListConfirmed,
						transactionPage: emptyPage,
						actions: [selectTransferType]
					},
					expected: {
						asyncTexts: [SCREEN_TEXT.messageEmptyTable],
						hiddenTexts: transactionHashTexts
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: filterCases });

			const filterSearchCriteriaCases = [
				{
					description: 'requests the transactions by type when the type filter is selected',
					config: {
						preloadedData: transactionListConfirmed,
						actions: [selectTransferType]
					},
					expected: { searchCriteria: { pageNumber: 1, types: TRANSACTION_TYPE.TRANSFER } }
				},
				{
					description: 'requests the transactions sent from the contact when the from filter is selected',
					config: {
						preloadedData: transactionListConfirmed,
						contacts: [contact],
						actions: [selectFromContact]
					},
					expected: { searchCriteria: { pageNumber: 1, from: contact.address } }
				},
				{
					description: 'requests the transactions sent to the contact when the to filter is selected',
					config: {
						preloadedData: transactionListConfirmed,
						contacts: [contact],
						actions: [selectToContact]
					},
					expected: { searchCriteria: { pageNumber: 1, to: contact.address } }
				}
			];

			runSearchCriteriaTests({
				renderPage,
				request: [TransactionService, 'fetchTransactionPage'],
				cases: filterSearchCriteriaCases
			});
		});
	});
});
