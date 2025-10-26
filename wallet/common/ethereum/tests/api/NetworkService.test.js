import { NetworkService } from '../../src/api/NetworkService';
import { NETWORK_CURRENCY_DIVISIBILITY, NETWORK_CURRENCY_ID, NETWORK_CURRENCY_NAME } from '../../src/constants';
import { runApiTest } from '../test-utils';
import { jest } from '@jest/globals';

const createJrpcExpectedCall = ({ nodeUrl, method, params, result }) => ({
	url: nodeUrl,
	options: {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: 1,
			method,
			params
		})
	},
	response: { result }
});

describe('api/NetworkService', () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	describe('fetchNodeList', () => {
		it('returns node list for given network identifier', async () => {
			// Arrange:
			const service = new NetworkService({
				config: {
					nodeList: {
						mainnet: ['http://node1:8545', 'http://node2:8545'],
						testnet: ['http://testnode:8545']
					}
				}
			});

			// Act:
			const result = await service.fetchNodeList('mainnet');

			// Assert:
			expect(result).toStrictEqual(['http://node1:8545', 'http://node2:8545']);
		});
	});

	describe('fetchNetworkInfo', () => {
		it('returns network info with identifier, height, fees and currency', async () => {
			// Arrange:
			const nodeUrl = 'http://localhost:8545';
			const mockMakeRequest = jest.fn();
			const expectedCalls = [
				createJrpcExpectedCall({
					nodeUrl,
					method: 'eth_chainId',
					params: [],
					result: '0x1'
				}),
				createJrpcExpectedCall({
					nodeUrl,
					method: 'eth_feeHistory',
					params: ['0xa', 'latest', [25, 50, 75]],
					result: {
						baseFeePerGas: [
							'0x0',
							'0x174876e800' // 100 gwei
						],
						reward: [
							['0x3b9aca00', '0x77359400', '0xb2d05e00'],     // [1g, 2g, 3g]
							['0x77359400', '0xb2d05e00', '0xee6b2800'],     // [2g, 3g, 4g]
							['0xb2d05e00', '0xee6b2800', '0x12a05f200']     // [3g, 4g, 5g]
						]
					}
				}),
				createJrpcExpectedCall({
					nodeUrl,
					method: 'eth_blockNumber',
					params: [],
					result: '0x74cbb1' // 7,654,321
				})
			];
			const expectedResult = {
				nodeUrl,
				wsUrl: 'ws://localhost:8546/ws',
				networkIdentifier: 'mainnet',
				chainId: 1,
				chainHeight: 7654321,
				transactionFees: {
					slow:   { maxPriorityFeePerGas: '0.000000002', maxFeePerGas: '0.000000122' },
					medium: { maxPriorityFeePerGas: '0.000000003', maxFeePerGas: '0.000000153' },
					fast:   { maxPriorityFeePerGas: '0.000000004', maxFeePerGas: '0.000000204' }
				},
				networkCurrency: {
					name: NETWORK_CURRENCY_NAME,
					id: NETWORK_CURRENCY_ID,
					divisibility: NETWORK_CURRENCY_DIVISIBILITY
				}
			};
			const service = new NetworkService({
				config: { nodeList: {} },
				makeRequest: mockMakeRequest
			});

			// Act & Assert:
			await runApiTest(
				mockMakeRequest,
				() => service.fetchNetworkInfo(nodeUrl),
				expectedCalls,
				{ expectedResult }
			);
		});

		const runMissingFeeTest = async feeHistoryResult => {
			// Arrange:
			const nodeUrl = 'http://localhost:8545';
			const mockMakeRequest = jest.fn();
			const expectedCalls = [
				createJrpcExpectedCall({
					nodeUrl,
					method: 'eth_chainId',
					params: [],
					result: '0x1'
				}),
				createJrpcExpectedCall({
					nodeUrl,
					method: 'eth_feeHistory',
					params: ['0xa', 'latest', [25, 50, 75]],
					result: feeHistoryResult
				}),
				createJrpcExpectedCall({
					nodeUrl,
					method: 'eth_blockNumber',
					params: [],
					result: '0x74cbb1'
				})
			];
			const service = new NetworkService({
				config: { nodeList: {} },
				makeRequest: mockMakeRequest
			});

			// Act & Assert:
			await runApiTest(
				mockMakeRequest,
				() => service.fetchNetworkInfo(nodeUrl),
				expectedCalls,
				{ expectedErrorMessage: 'Fee history data is missing in the node response.' }
			);
		};

		it('throws ApiError when node does not support eth_feeHistory', async () => {
			// Arrange:
			const feeHistoryResult = null;

			// Act & Assert:
			await runMissingFeeTest(feeHistoryResult);
		});

		it('throws ApiError when node returns incomplete eth_feeHistory', async () => {
			// Arrange:
			const feeHistoryResult = {};

			// Act & Assert:
			await runMissingFeeTest(feeHistoryResult);
		});
	});

	describe('pingNode', () => {
		it('returns current chain height from node', async () => {
			// Arrange:
			const nodeUrl = 'http://localhost:8545';
			const mockMakeRequest = jest.fn();
			const expectedCalls = [
				createJrpcExpectedCall({
					nodeUrl,
					method: 'eth_blockNumber',
					params: [],
					result: '0x12d687' // 1,234,567
				})
			];
			const expectedResult = 1234567;
			const service = new NetworkService({
				config: { nodeList: {} },
				makeRequest: mockMakeRequest
			});

			// Act & Assert:
			await runApiTest(
				mockMakeRequest,
				() => service.pingNode(nodeUrl),
				expectedCalls,
				{ expectedResult }
			);
		});
	});
});
