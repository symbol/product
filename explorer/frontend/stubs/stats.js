import { getAccountsStub } from "./accounts";

export const getStatsStub = async () => {
	const baseInfo = {
		price: 5.17,
		priceChange: 13,
		volume: 1200000000,
		circulatingSupply: 999999999999,
		treasury: 628549820,
		totalNodes: 145,
		supernodes: 66
	};

	const chainInfo = {
		height: 3999820,
		lastSafeBlock: 399120,
		blockGenerationTime: 15,
		averageFee: 0.005,
		difficulty: 70
	};

	const fees = {
		slow: 0.001,
		medium: 0.005,
		fast: 0.01
	};

	const accounts = {
		total: 1777154,
		harvesting: 8411,
		eligibleForHarvesting: 1005242
	}

	const transactions = {
		totalAll: 99888777154,
		total30Days: 8411,
		total24Hours: 316,
		averagePerBlock: 15,
	};

	const charts = {
		blockTime: new Array(30)
			.fill(null)
			.map((_, index) => [3999770 - 30 + index, Math.floor((Math.random() * 4 + 5 + (Math.log(index * 20) * 50) / 10) / 2)]),
		fee: new Array(30).fill(null).map((_, index) => [3999770 - 30 + index, Math.floor(Math.random() * 100) / 10000]),
		difficulty: new Array(30)
			.fill(null)
			.map((_, index) => [3999770 - 30 + index, Math.floor(Math.random() * 4 + 40 + (Math.log(index * 20) * 50) / 10)]),
		transactions: new Array(30)
			.fill(null)
			.map((_, index) => [
				new Date(Date.now() - 60 * Math.abs(index - 29) * 60000 * 24).getTime(),
				Math.floor(Math.random() * 100 + 300 + Math.log(index * 20) * 50)
			])
	};

	return Promise.resolve({
		baseInfo,
		chainInfo,
		fees,
		accounts,
		transactions,
		charts
	});
};


export const getTransactionChartStub = async (filter) => {
	switch (filter) {
		case 'perDay':
			return new Array(90)
				.fill(null)
				.map((_, index) => [
					new Date(Date.now() - 60 * Math.abs(index - 89) * 60000 * 24).getTime(),
					Math.floor(Math.random() * 100 + 300 + Math.log(index * 20) * 50)
				]);
		case 'perMonth':
			return new Array(36)
			.fill(null)
			.map((_, index) => [
				new Date(Date.now() - 60 * Math.abs(index - 35) * 60000 * 24 * 31).getTime(),
				Math.floor(Math.random() * 100 + 300 + Math.log(index * 20) * 50)
			]);
		default:
			return new Array(240)
				.fill(null)
				.map((_, index) => [
					3999770 + index,
					Math.floor(Math.random() * 100 + 300 + Math.log(index * 20) * 50)
				]);
	}
};

export const getAccountChartsStub = async () => {
	const accounts = (await getAccountsStub({pageNumber: 1, pageSize: 10})).slice(0, 9);

	return {
		importanceBreakdown: [
			...accounts.map(account => [account.importance, account.address]),
			[48.9, 'rest']
		],
		harvestingImportance: [[34.54, 'harvesting'], [65.46, 'not harvesting']]
	}
};
