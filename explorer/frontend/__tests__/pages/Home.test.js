import '@testing-library/jest-dom';
import { blockPageResult } from '../test-utils/blocks';
import { blockStatisticsResult, dailyTransactionChartResult, marketDataResult, transactionStatisticsResult } from '../test-utils/stats';
import { transactionPageResult } from '../test-utils/transactions';
import { activeVariant } from '../test-utils/variants';
import * as BlockService from '@/app/api/blocks';
import * as StatsService from '@/app/api/stats';
import * as TransactionService from '@/app/api/transactions';
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
	});

	describe('page', () => {
		it.each([0, 147])('displays the fetched total of %s without a supernode count', async total => {
			// Arrange:
			jest.spyOn(StatsService, 'fetchNodeStats').mockResolvedValue({ total, supernodes: null });

			// Act:
			const { props } = await getServerSideProps({ locale: 'en' });
			render(<Home {...props} />);

			// Assert:
			expect(props.nodeStats).toStrictEqual({ total, supernodes: null });
			expect(screen.getByText('field_totalNodes').nextSibling).toHaveTextContent(String(total));
			expect(screen.queryByText('field_supernodes')).not.toBeInTheDocument();
		});

		it('displays the supernode count only for NEM', async () => {
			// Arrange:
			jest.spyOn(StatsService, 'fetchNodeStats').mockResolvedValue({ total: 147, supernodes: 12 });

			// Act:
			const { props } = await getServerSideProps({ locale: 'en' });
			render(<Home {...props} />);

			// Assert:
			if (activeVariant === 'nem')
				expect(screen.getByText('field_supernodes').nextSibling).toHaveTextContent('12');
			else
				expect(screen.queryByText('field_supernodes')).not.toBeInTheDocument();
		});

		it('leaves the node total blank when fetching fails', async () => {
			// Arrange:
			jest.spyOn(StatsService, 'fetchNodeStats').mockRejectedValue(new Error('Nodewatch unavailable'));

			// Act:
			const { props } = await getServerSideProps({ locale: 'en' });
			render(<Home {...props} />);

			// Assert:
			expect(props.nodeStats).toStrictEqual({});
			expect(screen.getByText('field_totalNodes').nextSibling).toBeEmptyDOMElement();
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
