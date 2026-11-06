// Symbol variant — market data uses CoinGecko; other statistics remain stubbed.
import { stubAccountStats, stubBlockStats, stubNodes, stubTransactionChart, stubTransactionStats } from './fixtures';
import { stubValue } from './stub';
import config from '@/app/config';
import { makeRequest } from '@/app/utils/server';

export const fetchAccountStats = stubValue(stubAccountStats);
export const fetchTransactionChart = stubValue(stubTransactionChart);
export const fetchTransactionStats = stubValue(stubTransactionStats);
export const fetchBlockStats = stubValue(stubBlockStats);
export const fetchNodeStats = () => Promise.resolve({ total: stubNodes.length, supernodes: 2 });
export const fetchMarketData = async () => {
	const response = await makeRequest(config.PUBLIC_SYMBOL_MARKET_DATA_URL);

	if (!Array.isArray(response))
		throw new Error('Invalid Symbol market data response');

	const data = response.find(item => item?.id === 'symbol' && item?.symbol === 'xym');

	if (!data)
		throw new Error('Symbol market data not found');

	const fields = ['current_price', 'price_change_percentage_24h', 'total_volume', 'circulating_supply', 'market_cap'];
	fields.forEach(field => {
		const value = data[field];
		const isOptional = field === 'circulating_supply' || field === 'market_cap';

		if (isOptional && value == null)
			return;

		if (!Number.isFinite(value) || (field !== 'price_change_percentage_24h' && value < 0))
			throw new Error(`Invalid Symbol market data field: ${field}`);
	});

	return {
		price: data.current_price,
		priceChange: data.price_change_percentage_24h,
		volume: data.total_volume,
		circulatingSupply: data.circulating_supply > 0 ? data.circulating_supply : null,
		marketCap: data.market_cap > 0 ? data.market_cap : null
	};
};
// Match NEM's local-calendar date selection; this is a daily snapshot, not an intraday quote.
export const fetchPriceByDate = async (timestamp, currency) => {
	const date = new Date(timestamp);
	const day = String(date.getDate()).padStart(2, '0');
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const formattedDate = `${day}-${month}-${date.getFullYear()}`;
	const url = new URL(config.PUBLIC_SYMBOL_HISTORICAL_PRICE_URL);
	url.searchParams.set('date', formattedDate);
	const response = await makeRequest(url.toString());

	if (!response || response.id !== 'symbol' || response.symbol !== 'xym')
		throw new Error('Invalid Symbol historical price response');

	const marketData = response.market_data;
	const prices = marketData?.current_price;
	if ((marketData != null && (typeof marketData !== 'object' || Array.isArray(marketData)))
		|| (prices != null && (typeof prices !== 'object' || Array.isArray(prices))))
		throw new Error('Invalid Symbol historical price response');

	const price = prices?.[currency.toLowerCase()];
	if (price == null || price === 0)
		return null;

	if (!Number.isFinite(price) || price < 0)
		throw new Error('Invalid Symbol historical price');

	return price;
};
