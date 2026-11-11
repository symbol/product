import '@testing-library/jest-dom';
import { blockPageResult } from '../test-utils/blocks';
import { blockStatisticsResult, dailyTransactionChartResult, marketDataResult, transactionStatisticsResult } from '../test-utils/stats';
import { transactionPageResult } from '../test-utils/transactions';
import * as BlockService from '@/app/api/blocks';
import * as StatsService from '@/app/api/stats';
import * as TransactionService from '@/app/api/transactions';
import { TRANSACTION_GROUP } from '@/app/constants';
import Home, { getServerSideProps } from '@/app/pages/index';
import { act, render, screen } from '@testing-library/react';
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en.json';

TimeAgo.addDefaultLocale(en);

jest.mock('next/router', () => ({
	useRouter: () => ({ locale: 'en' })
}));

jest.mock('@/app/api/blocks', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/blocks')
	};
});

jest.mock('@/app/api/stats', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/stats')
	};
});

jest.mock('@/app/api/transactions', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/transactions')
	};
});

const chainStatusResult = { height: blockPageResult.data[0].height, finalizedHeight: null };
const nodeStatsResult = { total: 3, supernodes: 2 };

beforeAll(() => {
	jest.useFakeTimers();
});

beforeEach(() => {
	jest.spyOn(BlockService, 'fetchBlockPage').mockResolvedValue(blockPageResult);
	jest.spyOn(BlockService, 'fetchChainStatus').mockResolvedValue(chainStatusResult);
	jest.spyOn(TransactionService, 'fetchTransactionPage').mockResolvedValue(transactionPageResult);
	jest.spyOn(StatsService, 'fetchBlockStats').mockResolvedValue(blockStatisticsResult);
	jest.spyOn(StatsService, 'fetchMarketData').mockResolvedValue(marketDataResult);
	jest.spyOn(StatsService, 'fetchNodeStats').mockResolvedValue(nodeStatsResult);
	jest.spyOn(StatsService, 'fetchTransactionStats').mockResolvedValue(transactionStatisticsResult);
	jest.spyOn(StatsService, 'fetchTransactionChart').mockResolvedValue(dailyTransactionChartResult);
});

describe('Home', () => {
	const RECENT_BLOCK_COUNT = 50;
	const DATA_REFRESH_INTERVAL = 60000;

	describe('getServerSideProps', () => {
		it('preloads the recent block page', async () => {
			// Arrange:
			const locale = 'en';
			const fetchBlockPage = jest.spyOn(BlockService, 'fetchBlockPage');

			// Act:
			await getServerSideProps({ locale });

			// Assert:
			expect(fetchBlockPage).toHaveBeenCalledWith({ pageSize: RECENT_BLOCK_COUNT });
		});

		it('preloads no pending transaction page when unconfirmed transactions cannot be fetched', async () => {
			// Arrange:
			const locale = 'en';
			jest.spyOn(TransactionService, 'fetchTransactionPage').mockImplementation(async ({ group }) => {
				if (group === TRANSACTION_GROUP.UNCONFIRMED)
					throw Error('Request failed with status code 500');

				return transactionPageResult;
			});

			// Act:
			const { props } = await getServerSideProps({ locale });

			// Assert:
			expect(props.preloadedLatestTransactions).toEqual(transactionPageResult);
			expect(props.preloadedPendingTransactions).toBeNull();
		});
	});

	describe('page', () => {
		const createProps = preloadedPendingTransactions => ({
			preloadedBlocks: blockPageResult,
			preloadedLatestTransactions: transactionPageResult,
			preloadedPendingTransactions,
			transactionChart: dailyTransactionChartResult,
			transactionStats: transactionStatisticsResult,
			marketData: marketDataResult,
			nodeStats: nodeStatsResult,
			blockTime: blockStatisticsResult.blockTime
		});

		it('renders an error instead of pending transactions when they are unavailable', () => {
			// Act:
			render(<Home {...createProps(null)} />);

			// Assert:
			expect(screen.getByText('message_pendingTransactionsUnavailable')).toBeInTheDocument();
		});

		it('replaces the error with pending transactions once a refresh succeeds', async () => {
			// Arrange:
			const pendingTransactionHash = 'PENDING_TRANSACTION_HASH';
			const pendingTransactionPage = {
				...transactionPageResult,
				data: [{ ...transactionPageResult.data[0], hash: pendingTransactionHash, group: TRANSACTION_GROUP.UNCONFIRMED }]
			};
			jest.spyOn(TransactionService, 'fetchTransactionPage').mockImplementation(async ({ group }) =>
				(group === TRANSACTION_GROUP.UNCONFIRMED ? pendingTransactionPage : transactionPageResult));
			render(<Home {...createProps(null)} />);

			// Act:
			await act(async () => {
				jest.advanceTimersByTime(DATA_REFRESH_INTERVAL);
			});

			// Assert:
			expect(screen.queryByText('message_pendingTransactionsUnavailable')).not.toBeInTheDocument();
			expect(screen.getByTitle(pendingTransactionHash)).toBeInTheDocument();
		});

		it('does not render the error when pending transactions are available', () => {
			// Act:
			render(<Home {...createProps(transactionPageResult)} />);

			// Assert:
			expect(screen.queryByText('message_pendingTransactionsUnavailable')).not.toBeInTheDocument();
		});

		it('requests the recent block page of the preloaded size on refresh', async () => {
			// Arrange:
			const fetchBlockPage = jest.spyOn(BlockService, 'fetchBlockPage');
			const props = {
				preloadedBlocks: blockPageResult,
				preloadedLatestTransactions: transactionPageResult,
				preloadedPendingTransactions: transactionPageResult,
				transactionChart: dailyTransactionChartResult,
				transactionStats: transactionStatisticsResult,
				marketData: marketDataResult,
				nodeStats: nodeStatsResult,
				blockTime: blockStatisticsResult.blockTime
			};
			render(<Home {...props} />);

			// Act:
			await act(async () => {
				jest.advanceTimersByTime(DATA_REFRESH_INTERVAL);
			});

			// Assert:
			expect(fetchBlockPage).toHaveBeenCalledWith({ pageSize: RECENT_BLOCK_COUNT });
		});
	});
});
