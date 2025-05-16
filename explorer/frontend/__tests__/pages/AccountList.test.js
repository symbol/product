import '@testing-library/jest-dom';
import { accountPageResult } from '../test-utils/accounts';
import { setDevice } from '../test-utils/device';
import { accountStatisticsResult } from '../test-utils/stats';
import * as AccountService from '@/api/nem/accounts';
import * as StatsService from '@/api/nem/stats';
import AccountList, { getServerSideProps } from '@/pages/accounts/index';
import { render, screen } from '@testing-library/react';

jest.mock('@/api/nem/accounts', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/nem/accounts')
	};
});

jest.mock('@/api/nem/stats', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/nem/stats')
	};
});

describe('AccountList', () => {
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
	});
});
