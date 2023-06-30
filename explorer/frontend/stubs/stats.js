export const getStatsStub = async () => {
	const baseInfo = {
		totalTransactions: 99888777154,
		transactionsPerBlock: 15,
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
		charts
	});
};
