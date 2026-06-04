jest.mock('@/utils/server', () => ({
	__esModule: true,
	...jest.requireActual('@/utils/server'),
	makeRequest: jest.fn()
}));

describe('variants/symbol/api stats and nodes', () => {
	const originalAppConfig = window.appConfig;

	beforeEach(() => {
		jest.resetModules();
		window.appConfig = {
			PLATFORM: 'symbol',
			NATIVE_MOSAIC_ID: 'E74B99BA41F4AFEE',
			NATIVE_MOSAIC_TICKER: 'XYM',
			NATIVE_MOSAIC_DIVISIBILITY: 6,
			REQUEST_TIMEOUT: 5000,
			SYMBOL_NODE_URL: 'https://symbol.node',
			SYMBOL_NETWORK_IDENTIFIER: 152,
			SYMBOL_EPOCH_ADJUSTMENT: 1667250467
		};
	});

	afterEach(() => {
		window.appConfig = originalAppConfig;
	});

	it('maps Symbol node peers and node statistics', async () => {
		// Arrange:
		const { makeRequest } = require('@/utils/server');
		const { fetchNodeList } = require('@/variants/symbol/api/nodes');
		const { fetchNodeStats } = require('@/variants/symbol/api/stats');
		makeRequest
			.mockResolvedValueOnce([
				{
					endpoint: 'https://node.example',
					friendlyName: 'Friendly node',
					version: '1.0.0',
					height: 1234,
					publicKey: 'MAIN_PUBLIC_KEY',
					balance: '100',
					roles: 3
				},
				{
					host: 'fallback.example',
					nodePublicKey: 'NODE_PUBLIC_KEY'
				}
			])
			.mockResolvedValueOnce([
				{ endpoint: 'https://node-a.example' },
				{ endpoint: 'https://node-b.example' }
			]);

		// Act:
		const nodes = await fetchNodeList();
		const stats = await fetchNodeStats();

		// Assert:
		expect(nodes).toEqual([
			{
				endpoint: 'https://node.example',
				name: 'Friendly node',
				version: '1.0.0',
				height: 1234,
				mainPublicKey: 'MAIN_PUBLIC_KEY',
				nodePublicKey: 'MAIN_PUBLIC_KEY',
				balance: '100',
				roles: 3
			},
			{
				endpoint: 'fallback.example',
				name: 'fallback.example',
				version: null,
				height: null,
				mainPublicKey: 'NODE_PUBLIC_KEY',
				nodePublicKey: 'NODE_PUBLIC_KEY',
				balance: null,
				roles: undefined
			}
		]);
		expect(stats).toEqual({
			total: 2,
			supernodes: null
		});
	});

	it('computes Symbol account, transaction, and block statistics', async () => {
		// Arrange:
		const { makeRequest } = require('@/utils/server');
		const {
			fetchAccountStats,
			fetchBlockStats,
			fetchTransactionChart,
			fetchTransactionStats
		} = require('@/variants/symbol/api/stats');
		makeRequest
			.mockResolvedValueOnce({
				data: [
					{
						meta: { totalFee: '1000000', totalTransactionsCount: 3 },
						block: { height: '2', timestamp: '1000' }
					},
					{
						meta: { totalFee: '2000000', totalTransactionsCount: 1 },
						block: { height: '1', timestamp: '0' }
					}
				]
			})
			.mockResolvedValueOnce({
				data: [
					{
						meta: { totalFee: '1000000', totalTransactionsCount: 3 },
						block: { height: '3', timestamp: '2000', difficulty: '20000000000000' }
					},
					{
						meta: { totalFee: '2000000', totalTransactionsCount: 2 },
						block: { height: '2', timestamp: '1000', difficulty: '10000000000000' }
					},
					{
						meta: { totalFee: '3000000', totalTransactionsCount: 1 },
						block: { height: '1', timestamp: '0', difficulty: '5000000000000' }
					}
				]
			});

		// Act:
		const accountStats = await fetchAccountStats();
		const transactionChart = await fetchTransactionChart();
		const transactionStats = await fetchTransactionStats();
		const blockStats = await fetchBlockStats();

		// Assert:
		expect(accountStats).toEqual({
			total: null,
			harvesting: null,
			eligibleForHarvesting: null,
			top10AccountsImportance: null,
			harvestingAccountsPercentage: null,
			importanceBreakdown: [],
			harvestingAccountsChart: []
		});
		expect(transactionChart).toEqual([]);
		expect(transactionStats).toEqual({
			averagePerBlock: 2,
			total: 4,
			last30Day: null,
			last24Hours: null
		});
		expect(blockStats).toEqual({
			blockTimeChart: [
				[2, 1],
				[3, 1]
			],
			blockFeeChart: [
				[2, 2],
				[3, 1]
			],
			blockDifficultyChart: [
				[2, '10.00'],
				[3, '20.00']
			],
			blockTime: 1,
			blockFee: 1.5,
			blockDifficulty: '20.00'
		});
	});
});
