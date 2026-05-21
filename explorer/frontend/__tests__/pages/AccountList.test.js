import '@testing-library/jest-dom';
import { accountPageResult } from '../test-utils/accounts';
import { setDevice } from '../test-utils/device';
import { accountStatisticsResult } from '../test-utils/stats';
import * as AccountService from '@/api/accounts';
import * as StatsService from '@/api/stats';
import AccountList, { formatAccountListCSV, getServerSideProps } from '@/pages/accounts/index';
import { pageConfig } from '@/variants';
import { render, screen } from '@testing-library/react';

jest.mock('@/api/accounts', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/accounts')
	};
});

jest.mock('@/api/stats', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/stats')
	};
});

describe('AccountList', () => {
	const originalAccountsConfig = { ...pageConfig.accounts };

	afterEach(() => {
		Object.assign(pageConfig.accounts, originalAccountsConfig);
	});

	describe('getServerSideProps', () => {
		it('fetches account list and statistics', async () => {
			// Arrange:
			const locale = 'en';
			const fetchAccountPage = jest.spyOn(AccountService, 'fetchAccountPage');
			fetchAccountPage.mockResolvedValue(accountPageResult);
			const fetchAccountStats = jest.spyOn(StatsService, 'fetchAccountStats');
			fetchAccountStats.mockResolvedValue(accountStatisticsResult);
			const expectedResult = {
				props: {
					preloadedData: accountPageResult.data,
					stats: accountStatisticsResult
				}
			};

			// Act:
			const result = await getServerSideProps({ locale });

			// Assert:
			expect(fetchAccountPage).toHaveBeenCalledWith();
			expect(fetchAccountStats).toHaveBeenCalledWith();
			expect(result).toEqual(expectedResult);
		});
	});

	describe('page', () => {
		const runTest = () => {
			// Arrange:
			const pageSectionText = 'section_accounts';
			const accountAddresses = accountPageResult.data.map(account => account.address);

			// Act:
			render(<AccountList preloadedData={accountPageResult.data} stats={accountStatisticsResult} />);

			// Assert:
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			accountAddresses.forEach(address => {
				expect(screen.getByText(address)).toBeInTheDocument();
			});
		};

		it('renders page with the list of accounts on desktop', () => {
			// Act + Assert:
			runTest();
		});

		it('renders page with the list of accounts on mobile', () => {
			// Arrange:
			setDevice('mobile');

			// Act + Assert:
			runTest();
		});

		it('does not render harvesting label on mobile when harvesting filter is disabled', () => {
			// Arrange:
			setDevice('mobile');
			pageConfig.accounts.showActiveHarvestingFilter = false;

			// Act:
			render(<AccountList
				preloadedData={[
					{
						...accountPageResult.data[0],
						isHarvestingActive: true
					}
				]}
				stats={accountStatisticsResult}
			/>);

			// Assert:
			expect(screen.queryByAltText('harvesting')).not.toBeInTheDocument();
		});

		it('renders namespace column when enabled by variant config', () => {
			// Arrange:
			pageConfig.accounts.showNamespace = true;

			// Act:
			render(<AccountList
				preloadedData={[
					{
						...accountPageResult.data[0],
						namespaces: ['alice', 'company.alice']
					},
					{
						...accountPageResult.data[1],
						namespaces: []
					}
				]}
				stats={accountStatisticsResult}
			/>);

			// Assert:
			expect(screen.getByText('table_field_namespace')).toBeInTheDocument();
			expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute('href', '/namespaces/alice');
			expect(screen.getByRole('link', { name: 'company.alice' })).toHaveAttribute('href', '/namespaces/company.alice');
			expect(screen.getByText('N/A')).toBeInTheDocument();
		});

		it('does not render namespace column when disabled by variant config', () => {
			// Arrange:
			pageConfig.accounts.showNamespace = false;

			// Act:
			render(<AccountList
				preloadedData={[
					{
						...accountPageResult.data[0],
						namespaces: ['alice']
					}
				]}
				stats={accountStatisticsResult}
			/>);

			// Assert:
			expect(screen.queryByText('table_field_namespace')).not.toBeInTheDocument();
			expect(screen.queryByText('alice')).not.toBeInTheDocument();
		});

		it('renders account filters from variant config', () => {
			// Arrange:
			pageConfig.accounts.showLatestFilter = true;
			pageConfig.accounts.showRichListFilter = true;
			pageConfig.accounts.showActiveHarvestingFilter = false;

			// Act:
			render(<AccountList preloadedData={accountPageResult.data} stats={accountStatisticsResult} />);

			// Assert:
			expect(screen.getByText('filter_latest')).toBeInTheDocument();
			expect(screen.getByText('filter_richList')).toBeInTheDocument();
			expect(screen.queryByText('filter_activeHarvesting')).not.toBeInTheDocument();
		});
	});

	describe('CSV formatter', () => {
		const translate = key => `translated_${key}`;

		it('exports only visible account columns when namespace column is enabled', () => {
			// Arrange:
			pageConfig.accounts.showNamespace = true;
			const row = {
				address: 'TA77LIQZ7OWKIIP5GPMLPQV7NJ27SYNA7WILGVQ',
				namespaces: ['pasomi.sn'],
				description: null,
				balance: 123,
				importance: 4.56,
				isMultisig: false,
				isHarvestingActive: true
			};

			// Act:
			const result = formatAccountListCSV(row, translate);

			// Assert:
			expect(result).toEqual({
				translated_table_field_address: 'TA77LIQZ7OWKIIP5GPMLPQV7NJ27SYNA7WILGVQ',
				translated_table_field_namespace: 'pasomi.sn',
				translated_table_field_description: null,
				translated_table_field_balance: 123,
				translated_table_field_importance: 4.56
			});
		});

		it('omits namespace when namespace column is disabled', () => {
			// Arrange:
			pageConfig.accounts.showNamespace = false;

			// Act:
			const result = formatAccountListCSV({
				address: 'NANEPSBUVE5NLYXCTP52LK3YAOSZUAIVOAD4FGSV',
				namespaces: ['alice'],
				description: 'known',
				balance: 1,
				importance: 2
			}, translate);

			// Assert:
			expect(result).toEqual({
				translated_table_field_address: 'NANEPSBUVE5NLYXCTP52LK3YAOSZUAIVOAD4FGSV',
				translated_table_field_description: 'known',
				translated_table_field_balance: 1,
				translated_table_field_importance: 2
			});
		});
	});
});
