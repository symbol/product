import '@testing-library/jest-dom';
import { cosignatoryAccount, harvestingAccount, multisigAccount } from '../../__fixtures__/local/account';
import { accountList } from '../../__fixtures__/local/account-list';
import { accountStats } from '../../__fixtures__/local/account-stats';
import {
	clearFilterChip,
	runGetServerSidePropsTests,
	runRenderScenarioTests,
	runSearchCriteriaTests,
	runTableErrorTest,
	toggleFilterChip
} from '../test-utils/page';
import * as AccountService from '@/app/api/accounts';
import * as StatsService from '@/app/api/stats';
import AccountList, { getServerSideProps } from '@/app/pages/accounts';
import { fireEvent, render, screen } from '@testing-library/react';

// Mocks

jest.mock('@/app/api/accounts', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/accounts')
	};
});

jest.mock('@/app/api/stats', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/stats')
	};
});

beforeEach(() => {
	jest.spyOn(AccountService, 'fetchAccountPage').mockResolvedValue(emptyPage);
});

// Constants

const SCREEN_TEXT = {
	sectionAccounts: 'section_accounts',
	fieldTotalAccounts: 'field_totalAccounts',
	fieldHarvestingAccounts: 'field_harvestingAccounts',
	fieldAccountsEligibleForHarvesting: 'field_accountsEligibleForHarvesting',
	chartNameImportanceBreakdown: 'chart_name_importance_breakdown',
	chartNameHarvestingOfEligible: 'chart_name_harvesting_of_eligible',
	filterLatest: 'filter_latest',
	filterActiveHarvesting: 'filter_activeHarvesting',
	buttonCsv: 'button_csv',
	messageEmptyTable: 'message_emptyTable',
	tableFieldAddress: 'table_field_address',
	tableFieldDescription: 'table_field_description',
	tableFieldBalance: 'table_field_balance',
	tableFieldImportance: 'table_field_importance'
};

const mockedChartText = 'Mocked React ApexCharts';
const harvestingAccountImportanceText = '2.74509 %';
const accountDescription = 'Account description text..';
const accountPage = {
	data: accountList,
	pageNumber: 1
};
const harvestingAccountPage = {
	data: accountList.filter(account => account.isHarvestingActive),
	pageNumber: 1
};
const emptyPage = {
	data: [],
	pageNumber: 1
};

// Tests

describe('AccountList', () => {
	describe('getServerSideProps', () => {
		const requests = {
			accountPage: [AccountService, 'fetchAccountPage'],
			accountStats: [StatsService, 'fetchAccountStats']
		};

		const getServerSidePropsCases = [
			{
				description: 'returns the preloaded accounts and the account stats props',
				config: {
					responses: {
						accountPage,
						accountStats
					}
				},
				expected: {
					requestArguments: {
						accountPage: [],
						accountStats: []
					},
					result: {
						props: {
							preloadedData: accountList,
							stats: accountStats
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
			if (config.accountPage)
				AccountService.fetchAccountPage.mockResolvedValue(config.accountPage);
			render(<AccountList preloadedData={config.preloadedData} stats={accountStats} />);
		};

		const renderFilteredPage = () => {
			renderPage({ preloadedData: accountList });
			fireEvent.click(screen.getByText(SCREEN_TEXT.filterActiveHarvesting));
		};

		describe('section: accounts', () => {
			const accountsCases = [
				{
					description: 'renders the account stats',
					config: { preloadedData: accountList },
					expected: {
						texts: [
							SCREEN_TEXT.sectionAccounts,
							SCREEN_TEXT.fieldTotalAccounts,
							accountStats.total,
							SCREEN_TEXT.fieldHarvestingAccounts,
							accountStats.harvesting,
							SCREEN_TEXT.fieldAccountsEligibleForHarvesting,
							accountStats.eligibleForHarvesting,
							`${accountStats.top10AccountsImportance}%`,
							SCREEN_TEXT.chartNameImportanceBreakdown,
							`${accountStats.harvestingAccountsPercentage}%`,
							SCREEN_TEXT.chartNameHarvestingOfEligible
						],
						asyncTextOccurrences: { [mockedChartText]: 2 }
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: accountsCases });
		});

		describe('account table', () => {
			const accountTableCases = [
				{
					description: 'renders the table headers, the account rows and the CSV button',
					config: { preloadedData: accountList },
					expected: {
						texts: [
							SCREEN_TEXT.buttonCsv,
							SCREEN_TEXT.tableFieldAddress,
							SCREEN_TEXT.tableFieldDescription,
							SCREEN_TEXT.tableFieldBalance,
							SCREEN_TEXT.tableFieldImportance,
							...accountList.map(account => account.address),
							harvestingAccountImportanceText
						],
						titles: accountList.map(account => `${account.balance} XEM`)
					}
				},
				{
					description: 'renders the account description',
					config: {
						preloadedData: [{
							...cosignatoryAccount,
							description: accountDescription
						}]
					},
					expected: {
						texts: [accountDescription]
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: accountTableCases });

			runTableErrorTest('renders the try-again action when the account request fails', {
				renderPage: renderFilteredPage,
				request: [AccountService, 'fetchAccountPage']
			});
		});

		describe('filter', () => {
			const toggleLatestFilter = toggleFilterChip(SCREEN_TEXT.filterLatest);
			const toggleActiveHarvestingFilter = toggleFilterChip(SCREEN_TEXT.filterActiveHarvesting);

			const filterCases = [
				{
					description: 'renders only the harvesting accounts when the active harvesting filter is selected',
					config: {
						preloadedData: accountList,
						accountPage: harvestingAccountPage,
						actions: [toggleActiveHarvestingFilter]
					},
					expected: {
						asyncTexts: [harvestingAccount.address],
						hiddenTexts: [cosignatoryAccount.address, multisigAccount.address]
					}
				},
				{
					description: 'renders the empty message when no account matches the filter',
					config: {
						preloadedData: accountList,
						accountPage: emptyPage,
						actions: [toggleActiveHarvestingFilter]
					},
					expected: {
						asyncTexts: [SCREEN_TEXT.messageEmptyTable],
						hiddenTexts: accountList.map(account => account.address)
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: filterCases });

			const filterSearchCriteriaCases = [
				{
					description: 'requests the latest accounts when the latest filter is selected',
					config: {
						preloadedData: accountList,
						actions: [toggleLatestFilter]
					},
					expected: { searchCriteria: { pageNumber: 1, isLatest: true } }
				},
				{
					description: 'requests the harvesting accounts when the active harvesting filter is selected',
					config: {
						preloadedData: accountList,
						actions: [toggleActiveHarvestingFilter]
					},
					expected: { searchCriteria: { pageNumber: 1, isActiveHarvesting: true } }
				},
				{
					description: 'requests the latest active harvesting accounts when both filters are selected',
					config: {
						preloadedData: accountList,
						actions: [toggleLatestFilter, toggleActiveHarvestingFilter]
					},
					expected: { searchCriteria: { pageNumber: 1, isLatest: true, isActiveHarvesting: true } }
				},
				{
					description: 'requests all accounts again when the latest filter is cleared',
					config: {
						preloadedData: accountList,
						actions: [toggleLatestFilter, clearFilterChip(SCREEN_TEXT.filterLatest)]
					},
					expected: { searchCriteria: { pageNumber: 1 } }
				}
			];

			runSearchCriteriaTests({
				renderPage,
				request: [AccountService, 'fetchAccountPage'],
				cases: filterSearchCriteriaCases
			});
		});
	});
});
