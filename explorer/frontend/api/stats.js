import { fetchAccountPage } from './accounts';
import { fetchBlockPage } from './blocks';
import config from '@/config';
import { transactionChartFilterToType, truncateDecimals } from '@/utils/common';
import { createAPIURL, makeRequest } from '@/utils/server';

export const fetchAccountStats = async () => {
	const stats = await makeRequest(createAPIURL('account/statistics'));
	const accounts = (await fetchAccountPage({ pageNumber: 1, pageSize: 10 })).data;
	const top10AccountsImportance = accounts.reduce((partialSum, account) => partialSum + account.importance, 0);
	const restAccountsImportance = 100 - top10AccountsImportance;
	const harvestingAccountsPercentage = truncateDecimals((stats.harvestedAccounts / stats.total) * 100, 2);

	return {
		total: stats.total,
		harvesting: stats.harvestedAccounts,
		eligibleForHarvesting: stats.eligibleHarvestAccounts,
		top10AccountsImportance: truncateDecimals(top10AccountsImportance, 2),
		harvestingAccountsPercentage,
		importanceBreakdown: [
			...accounts.map(account => [truncateDecimals(account.importance, 4), account.address]),
			[truncateDecimals(restAccountsImportance, 4), 'Rest']
		],
		harvestingAccountsChart: [
			[harvestingAccountsPercentage, 'Harvesting'],
			[100 - harvestingAccountsPercentage, 'Not harvesting']
		]
	};
};

export const fetchTransactionChart = async filter => {
	const type = transactionChartFilterToType(filter);
	const currentDate = new Date();
	const endDateString = currentDate.toISOString().slice(0, 10);

	switch (type) {
		case 'daily': {
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - 90);
			const startDateString = startDate.toISOString().slice(0, 10);
			const response = await makeRequest(createAPIURL(`transaction/daily?startDate=${startDateString}&endDate=${endDateString}`));

			return response.map(item => [item.date, item.totalTransactions]);
		}
		case 'monthly': {
			const startDate = new Date();
			startDate.setMonth(startDate.getMonth() - 48);
			const startDateString = startDate.toISOString().slice(0, 10);
			const response = await makeRequest(createAPIURL(`transaction/monthly?startDate=${startDateString}&endDate=${endDateString}`));

			return response.map(item => [`${item.month}-01`, item.totalTransactions]);
		}
		default:
			return (await fetchBlockPage({ pageSize: 240 })).data.map(item => [item.height, item.transactionCount]).reverse();
	}
};

export const fetchTransactionStats = async () => {
	const stats = await makeRequest(createAPIURL('transaction/statistics'));
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

export const fetchPriceByDate = async (timestamp, currency) => {
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
