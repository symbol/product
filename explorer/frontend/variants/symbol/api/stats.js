import { fetchBlockPage } from './blocks';
import config from '@/config';
import { makeRequest } from '@/utils/server';

export const fetchAccountStats = async () => {
	return {
		total: 0,
		harvesting: 0,
		eligibleForHarvesting: 0,
		top10AccountsImportance: 0,
		harvestingAccountsPercentage: 0,
		importanceBreakdown: [],
		harvestingAccountsChart: []
	};
};

export const fetchTransactionChart = async filter => {
	return []
};

export const fetchTransactionStats = async () => {
	return {
		averagePerBlock: 0,
		total: 0,
		last30Day: 0,
		last24Hours: 0
	};
};

export const fetchBlockStats = async () => {
	const blockPage = await fetchBlockPage({ pageSize: 241 });
	const blocks = blockPage.data.slice(0, -1);
	const blockTimeChart = blocks
		.map((block, index) => [
			block.height,
			(new Date(block.timestamp).getTime() - new Date(blockPage.data[index + 1].timestamp).getTime()) / 1000
		])
		.reverse();
	const blockFeeChart = blocks.map(block => [block.height, block.totalFee]).reverse();
	const blockDifficultyChart = blocks.map(block => [block.height, block.difficulty]).reverse();

	return {
		blockTimeChart,
		blockFeeChart,
		blockDifficultyChart,
		blockTime: Math.round(blockTimeChart.reduce((partialSum, item) =>
			partialSum + item[1], 0) / blockTimeChart.length),
		blockFee: Number((blockFeeChart.reduce((partialSum, item) =>
			partialSum + item[1], 0) / blockFeeChart.length
		).toFixed(config.NATIVE_MOSAIC_DIVISIBILITY)),
		blockDifficulty: blocks[0].difficulty
	};
};

export const fetchNodeStats = async () => {
	return {
		total: 0,
	};
};

export const fetchMarketData = async () => {
	const response = await makeRequest(config.SYMBOL_MARKET_DATA_URL);
	const data = response.RAW.XYM.USD;

	return {
		price: data.PRICE,
		priceChange: data.CHANGEPCTDAY,
		volume: data.VOLUME24HOUR,
		circulatingSupply: data.CIRCULATINGSUPPLY,
		marketCap: data.MKTCAP,
		treasury: 0
	};
};

export const fetchPriceByDate = async (timestamp, currency) => {
	const date = new Date(timestamp);
	const yyyy = date.getFullYear();
	let mm = date.getMonth() + 1;
	let dd = date.getDate();

	if (dd < 10)
		dd = '0' + dd;
	if (mm < 10)
		mm = '0' + mm;

	const formattedDate = dd + '-' + mm + '-' + yyyy;
	const response = await makeRequest(`${config.SYMBOL_HISTORICAL_PRICE_URL}?date=${formattedDate}`);

	return response?.market_data?.current_price[currency.toLowerCase()] || null;
};
