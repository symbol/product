import '@testing-library/jest-dom';
import { blockPageResult } from '../test-utils/blocks';
import { blockStatisticsResult, dailyTransactionChartResult, marketDataResult, transactionStatisticsResult } from '../test-utils/stats';
import { transactionPageResult } from '../test-utils/transactions';
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

// These shared rendering checks run in both NEM and Symbol passes.
describe('Home market data', () => {
	const renderMarketData = async () => {
		const { props } = await getServerSideProps({ locale: 'en' });
		render(<Home {...props} />);

		return props;
	};
	const getMarketFieldValueElement = name => screen.getByText(`field_${name}`).parentElement.lastElementChild;

	it('renders unavailable supply and cap without units or manufactured values', async () => {
		// Arrange:
		StatsService.fetchMarketData.mockResolvedValue({ ...marketDataResult, circulatingSupply: null, marketCap: null });

		// Act:
		await renderMarketData();

		// Assert:
		expect(getMarketFieldValueElement('circulatingSupply').textContent).toBe('—');
		expect(getMarketFieldValueElement('marketCap').textContent).toBe('—');
	});

	it('renders unavailable market fields when fetching market data fails', async () => {
		// Arrange:
		StatsService.fetchMarketData.mockRejectedValue(new Error('Market data request failed'));

		// Act:
		const props = await renderMarketData();

		// Assert:
		expect(props.marketData).toStrictEqual({});
		['price', 'volume', 'circulatingSupply', 'marketCap'].forEach(name => {
			expect(getMarketFieldValueElement(name).textContent).toBe('—');
		});
		expect(StatsService.fetchMarketData).toHaveBeenCalledTimes(1);
	});

	it('preserves zero values in the shared display', async () => {
		// Arrange:
		StatsService.fetchMarketData.mockResolvedValue({ price: 0, priceChange: 0, volume: 0, circulatingSupply: 0, marketCap: 0 });

		// Act:
		await renderMarketData();

		// Assert:
		expect(getMarketFieldValueElement('price').textContent).toContain('$0');
		expect(getMarketFieldValueElement('volume').textContent).toBe('$0');
		expect(getMarketFieldValueElement('circulatingSupply').textContent).toBe('0 XEM');
		expect(getMarketFieldValueElement('marketCap').textContent).toBe('$0');
	});

	it('keeps populated market values formatted', async () => {
		// Arrange:
		StatsService.fetchMarketData.mockResolvedValue({
			price: 0.1234567, priceChange: -1.2, volume: 1234, circulatingSupply: 5678, marketCap: 9012
		});

		// Act:
		await renderMarketData();

		// Assert:
		expect(getMarketFieldValueElement('price').textContent).toContain('$0.1234567');
		expect(getMarketFieldValueElement('price').textContent).toContain('-1.2%');
		expect(getMarketFieldValueElement('volume').textContent).toBe('$1.23K');
		expect(getMarketFieldValueElement('circulatingSupply').textContent).toBe('5 678 XEM');
		expect(getMarketFieldValueElement('marketCap').textContent).toBe('$9.01K');
	});
});
