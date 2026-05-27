import { fetchBlockPage } from './blocks';
import { fetchNodeList } from './nodes';
import config from '@/config';
import { truncateDecimals } from '@/utils/common';
import { makeRequest } from '@/utils/server';

export const fetchAccountStats = async () => ({
	total: null,
	harvesting: null,
	eligibleForHarvesting: null,
	top10AccountsImportance: null,
	harvestingAccountsPercentage: null,
	importanceBreakdown: [],
	harvestingAccountsChart: []
});

export const fetchTransactionChart = async () => [];

export const fetchTransactionStats = async () => {
	const blocks = (await fetchBlockPage({ pageSize: 100 })).data;
	const totalTransactionCount = blocks.reduce((sum, item) => sum + item.transactionCount, 0);

	return {
		averagePerBlock: blocks.length ? truncateDecimals(totalTransactionCount / blocks.length, 1) : 0,
		total: totalTransactionCount,
		last30Day: null,
		last24Hours: null
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
		.filter(item => !Number.isNaN(item[1]))
		.reverse();
	const blockFeeChart = blocks.map(block => [block.height, block.totalFee]).reverse();
	const blockDifficultyChart = blocks.map(block => [block.height, block.difficulty]).reverse();
	const average = data => data.length ? data.reduce((sum, item) => sum + item[1], 0) / data.length : 0;

	return {
		blockTimeChart,
		blockFeeChart,
		blockDifficultyChart,
		blockTime: Math.round(average(blockTimeChart)),
		blockFee: Number(average(blockFeeChart).toFixed(config.NATIVE_MOSAIC_DIVISIBILITY || 0)),
		blockDifficulty: blocks[0]?.difficulty || 0
	};
};

export const fetchNodeStats = async () => {
	const nodes = await fetchNodeList();

	return {
		total: nodes.length,
		supernodes: null
	};
};

export const fetchMarketData = async () => {
	if (!config.SYMBOL_MARKET_DATA_URL) {
		return {
			price: null,
			priceChange: null,
			volume: null,
			circulatingSupply: null,
			marketCap: null
		};
	}

	const response = await makeRequest(config.SYMBOL_MARKET_DATA_URL);
	const data = response?.RAW?.XYM?.USD;

	return data ? {
		price: data.PRICE,
		priceChange: data.CHANGEPCTDAY,
		volume: data.VOLUME24HOUR,
		circulatingSupply: data.CIRCULATINGSUPPLY,
		marketCap: data.MKTCAP
	} : {
		price: response.USD,
		priceChange: null,
		volume: null,
		circulatingSupply: null,
		marketCap: null
	};
};

export const fetchPriceByDate = async () => null;
