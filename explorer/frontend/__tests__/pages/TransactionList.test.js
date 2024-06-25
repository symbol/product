import '@testing-library/jest-dom';
import 'react-intersection-observer/test-utils';
import { setDevice } from '../test-utils/device';
import { transactionStatisticsResult } from '../test-utils/stats';
import { transactionPageResult } from '../test-utils/transactions';
import * as StatsService from '@/api/stats';
import * as TransactionService from '@/api/transactions';
import TransactionList, { getServerSideProps } from '@/pages/transactions/index';
import * as utils from '@/utils';
import { render, screen } from '@testing-library/react';

jest.mock('@/api/transactions', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/transactions')
	};
});

jest.mock('@/api/stats', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/stats')
	};
});

describe('TransactionList', () => {
	describe('getServerSideProps', () => {
		it('fetches transaction list and statistics', async () => {
			// Arrange:
			const locale = 'en';
			const fetchTransactionPage = jest.spyOn(TransactionService, 'fetchTransactionPage');
			fetchTransactionPage.mockResolvedValue(transactionPageResult);
			const fetchTransactionStats = jest.spyOn(StatsService, 'fetchTransactionStats');
			fetchTransactionStats.mockResolvedValue(transactionStatisticsResult);
			const expectedResult = {
				props: {
					preloadedData: transactionPageResult.data,
					stats: transactionStatisticsResult
				}
			};

			// Act:
			const result = await getServerSideProps({ locale });

			// Assert:
			expect(fetchTransactionPage).toHaveBeenCalledWith();
			expect(fetchTransactionStats).toHaveBeenCalledWith();
			expect(result).toEqual(expectedResult);
		});
	});

	describe('page', () => {
		const runTest = () => {
			// Arrange:
			const pageSectionText = 'section_transactions';
			const transactionHashes = transactionPageResult.data.map(transaction => utils.truncateString(transaction.hash, 'hash'));

			// Act:
			render(<TransactionList preloadedData={transactionPageResult.data} stats={transactionStatisticsResult} />);

			// Assert:
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			transactionHashes.forEach(hash => {
				expect(screen.getByText(hash)).toBeInTheDocument();
			});
		};

		it('renders page with the list of transactions on desktop', () => {
			// Act + Assert:
			runTest();
		});

		it('renders page with the list of transactions on mobile', () => {
			// Arrange:
			setDevice('mobile');

			// Act + Assert:
			runTest();
		});
	});
});
