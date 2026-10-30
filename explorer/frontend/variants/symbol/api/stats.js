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
export const fetchPriceByDate = () => Promise.resolve(0.031);
