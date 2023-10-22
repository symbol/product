import { fetchAccountPage } from './accounts';
import { fetchBlockPage } from './blocks';
import { getTransactionChartStub } from '../stubs/stats';
import config from '@/config';
import { makeRequest, truncateDecimals } from '@/utils';

export const fetchAccountStats = async () => {
	const accounts = (await fetchAccountPage({ pageNumber: 1, pageSize: 10 })).data;
	const top10AccountsImportance = accounts.reduce((partialSum, account) => partialSum + account.importance, 0);
	const restAccountsImportance = 100 - top10AccountsImportance;

	return {
		total: 0,
		harvesting: 0,
		eligibleForHarvesting: 0,
		top10AccountsImportance: truncateDecimals(top10AccountsImportance, 2),
		importanceBreakdown: [...accounts.map(account => [account.importance, account.address]), [restAccountsImportance, 'Rest']],
		harvestingImportance: [
			[34.54, 'Harvesting'],
			[65.46, 'Not harvesting']
		]
	};
};

export const fetchTransactionChart = async ({ isPerDay, isPerMonth }) => {
	const filter = isPerDay ? 'perDay' : isPerMonth ? 'perMonth' : '';

	switch (filter) {
		case 'perDay':
			return getTransactionChartStub(filter);
		case 'perMonth':
			return getTransactionChartStub(filter);
		default:
			return (await fetchBlockPage({ pageSize: 240 })).data.map(item => [item.height, item.transactionCount]).reverse();
	}
};

export const fetchTransactionStats = async () => {
	const stats = await makeRequest(`${config.API_BASE_URL}/transaction/statistics`);
	const blocks = (await fetchBlockPage({ pageSize: 240 })).data;
	const total240Blocks = blocks.reduce((partialSum, block) => partialSum + block.transactionCount, 0);
	const averagePerBlock = Math.ceil(total240Blocks / blocks.length);

	return {
		averagePerBlock,
		total: stats.total,
		last30Day: stats.last30Day,
		last24Hours: stats.last24Hours
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
		blockTime: Math.round(blockTimeChart.reduce((partialSum, item) => partialSum + item[1], 0) / blockTimeChart.length),
		blockFee: Number(
			(blockFeeChart.reduce((partialSum, item) => partialSum + item[1], 0) / blockFeeChart.length).toFixed(
				config.NATIVE_MOSAIC_DIVISIBILITY
			)
		),
		blockDifficulty: blocks[0].difficulty
	};
};

export const fetchNodeStats = async () => {
	const [nodewatchResponse, supernodeResponse] = await Promise.all([
		makeRequest(config.NODELIST_URL),
		makeRequest(config.SUPERNODE_STATS_URL)
	]);

	return {
		total: nodewatchResponse.length,
		supernodes: supernodeResponse.participantCount
	};
};

export const fetchMarketData = async () => {
	const response = await makeRequest(config.MARKET_DATA_URL);
	const data = response.RAW.XEM.USD;

	return {
		price: data.PRICE,
		priceChange: data.CHANGEPCTDAY,
		volume: data.VOLUME24HOUR,
		circulatingSupply: data.CIRCULATINGSUPPLYMKTCAP,
		treasury: 0
	};
};

export const fetchPriceByDate = async (timestamp, currency = 'USD') => {
	const date = new Date(timestamp);
	const yyyy = date.getFullYear();
	let mm = date.getMonth() + 1;
	let dd = date.getDate();

	if (dd < 10) dd = '0' + dd;
	if (mm < 10) mm = '0' + mm;

	const formattedDate = dd + '-' + mm + '-' + yyyy;
	const response = await makeRequest(`${config.HISTORICAL_PRICE_URL}?date=${formattedDate}`);

	return response?.market_data?.current_price[currency.toLowerCase()] || null;
};
