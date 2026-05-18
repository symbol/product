import { NetworkService } from '../../src/api/NetworkService';
import { NETWORK_CURRENCY_DIVISIBILITY, NETWORK_CURRENCY_ID, NETWORK_CURRENCY_NAME, NETWORK_CURRENCY_TICKER } from '../../src/constants';
import { runApiTest } from '../test-utils';
import { jest } from '@jest/globals';

// Constants

const NODE_URL = 'http://localhost:8545';
const CHAIN_ID_HEX_MAINNET = '0x1';            // chain ID 1
const BLOCK_NUMBER_HEX = '0x74cbb1';           // 7,654,321
const BLOCK_HEIGHT = 7_654_321;
const PING_BLOCK_NUMBER_HEX = '0x12d687';      // 1,234,567
const PING_BLOCK_HEIGHT = 1_234_567;

// Node List Config

const nodeListConfig = {
	mainnet: ['http://node1:8545', 'http://node2:8545'],
	testnet: ['http://testnode:8545']
};

// Fee History Fixture
// 10 blocks, baseFee ending at 100 gwei, rewards: 25th/50th/75th percentiles per block

const feeHistoryResponse = {
	baseFeePerGas: [
		'0x0',
		'0x174876e800'   // 100 gwei
	],
	reward: [
		['0x3b9aca00', '0x77359400', '0xb2d05e00'],   // 1g, 2g, 3g
		['0x77359400', '0xb2d05e00', '0xee6b2800'],   // 2g, 3g, 4g
		['0xb2d05e00', '0xee6b2800', '0x12a05f200']   // 3g, 4g, 5g
	]
};

// Expected Values

const expectedNetworkCurrency = {
	name: NETWORK_CURRENCY_NAME,
	ticker: NETWORK_CURRENCY_TICKER,
	id: NETWORK_CURRENCY_ID,
	divisibility: NETWORK_CURRENCY_DIVISIBILITY
};

const expectedTransactionFees = {
	slow:   { maxPriorityFeePerGas: '0.000000002', maxFeePerGas: '0.000000122' },
	medium: { maxPriorityFeePerGas: '0.000000003', maxFeePerGas: '0.000000153' },
	fast:   { maxPriorityFeePerGas: '0.000000004', maxFeePerGas: '0.000000204' }
};

// Helpers

const createJrpcExpectedCall = ({ method, params, result }) => ({
	url: NODE_URL,
	options: {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
	},
	response: { result }
});

// Service Factory

const createService = ({ nodeList = nodeListConfig, makeRequest = jest.fn() } = {}) =>
	new NetworkService({ config: { nodeList }, makeRequest });

// Standard JRPC calls used across multiple tests

const chainIdCall = createJrpcExpectedCall({ method: 'eth_chainId', params: [], result: CHAIN_ID_HEX_MAINNET });
const blockNumberCall = createJrpcExpectedCall({ method: 'eth_blockNumber', params: [], result: BLOCK_NUMBER_HEX });
const feeHistoryCall = createJrpcExpectedCall({
	method: 'eth_feeHistory',
	params: ['0xa', 'latest', [25, 50, 75]],
	result: feeHistoryResponse
});

describe('api/NetworkService', () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	describe('fetchNodeList', () => {
		it('returns node list for the requested network identifier', async () => {
			// Arrange:
			const service = createService();

			// Act:
			const result = await service.fetchNodeList('mainnet');

			// Assert:
			expect(result).toStrictEqual(nodeListConfig.mainnet);
		});
	});

	describe('fetchNetworkInfo', () => {
		it('returns network info with identifier, chain height, fees and currency', async () => {
			// Arrange:
			const mockMakeRequest = jest.fn();
			const expectedCalls = [chainIdCall, feeHistoryCall, blockNumberCall];
			const service = createService({ makeRequest: mockMakeRequest });

			// Act & Assert:
			await runApiTest(
				mockMakeRequest,
				() => service.fetchNetworkInfo(NODE_URL),
				expectedCalls,
				{
					expectedResult: {
						nodeUrl: NODE_URL,
						wsUrl: 'ws://localhost:8546',
						networkIdentifier: 'mainnet',
						chainId: 1,
						chainHeight: BLOCK_HEIGHT,
						transactionFees: expectedTransactionFees,
						networkCurrency: expectedNetworkCurrency
					}
				}
			);
		});

		const runMissingFeeHistoryTest = (description, config) => {
			it(description, async () => {
				// Arrange:
				const mockMakeRequest = jest.fn();
				const invalidFeeHistoryCall = createJrpcExpectedCall({
					method: 'eth_feeHistory',
					params: ['0xa', 'latest', [25, 50, 75]],
					result: config.feeHistoryResult
				});
				const expectedCalls = [chainIdCall, invalidFeeHistoryCall, blockNumberCall];
				const service = createService({ makeRequest: mockMakeRequest });

				// Act & Assert:
				await runApiTest(
					mockMakeRequest,
					() => service.fetchNetworkInfo(NODE_URL),
					expectedCalls,
					{ expectedErrorMessage: 'Fee history data is missing in the node response.' }
				);
			});
		};

		const missingFeeHistoryTests = [
			{
				description: 'throws ApiError when node does not support eth_feeHistory (returns null)',
				config: { feeHistoryResult: null }
			},
			{
				description: 'throws ApiError when node returns incomplete eth_feeHistory (missing arrays)',
				config: { feeHistoryResult: {} }
			}
		];

		missingFeeHistoryTests.forEach(test => {
			runMissingFeeHistoryTest(test.description, test.config);
		});
	});

	describe('pingNode', () => {
		it('returns current chain height from node', async () => {
			// Arrange:
			const mockMakeRequest = jest.fn();
			const expectedCalls = [
				createJrpcExpectedCall({ method: 'eth_blockNumber', params: [], result: PING_BLOCK_NUMBER_HEX })
			];
			const service = createService({ makeRequest: mockMakeRequest });

			// Act & Assert:
			await runApiTest(
				mockMakeRequest,
				() => service.pingNode(NODE_URL),
				expectedCalls,
				{ expectedResult: PING_BLOCK_HEIGHT }
			);
		});
	});
});
