import { NetworkService } from '../../src/api/NetworkService';
import { networkTypeToIdentifier } from '../../src/utils';
import { runApiTest } from '../test-utils';
import { expect, jest } from '@jest/globals';
import { absoluteToRelativeAmount } from 'wallet-common-core';

describe('NetworkService', () => {
	let networkService;
	let mockMakeRequest;
	let mockApi;
	const config = {
		defaultNodes: {
			testnet: ['http://node-1:3000', 'http://node-2:3000'],
			mainnet: ['http://main-1:3000']
		},
		statisticsServiceURL: {
			testnet: 'http://stats.service'
		}
	};

	beforeEach(() => {
		mockMakeRequest = jest.fn();
		mockApi = {
			mosaic: {
				fetchMosaicInfo: jest.fn()
			}
		};
		networkService = new NetworkService({
			api: mockApi,
			config,
			makeRequest: mockMakeRequest
		});
		jest.clearAllMocks();
	});

	describe('getDefaultNodeList', () => {
		it('returns nodes from config', () => {
			const result = networkService.getDefaultNodeList('testnet');
			expect(result).toEqual(['http://node-1:3000', 'http://node-2:3000']);
		});
	});

	describe('fetchNodeList', () => {
		it('fetches suggested nodes and maps to restGatewayUrl', async () => {
			const networkIdentifier = 'testnet';
			const endpoint = `${config.statisticsServiceURL[networkIdentifier]}/nodes?filter=suggested&limit=30`;
			const nodesResponse = [
				{ apiStatus: { restGatewayUrl: 'http://api-1:3000' } },
				{ apiStatus: { restGatewayUrl: 'http://api-2:3000' } }
			];

			await runApiTest(
				mockMakeRequest,
				async () => {
					const urls = await networkService.fetchNodeList(networkIdentifier);
					expect(urls).toEqual(['http://api-1:3000', 'http://api-2:3000']);
				},
				[
					{
						url: endpoint,
						response: nodesResponse
					}
				]
			);
		});
	});

	describe('fetchNetworkInfo', () => {
		it('aggregates multiple endpoints and formats output', async () => {
			const nodeUrl = 'http://api.symbol.node:3000';
			const nodeInfo = {
				networkIdentifier: 152,
				networkGenerationHashSeed: 'GEN_HASH'
			};
			const networkProps = {
				chain: {
					currencyMosaicId: '0xABCD\'EF01',
					blockGenerationTargetTime: '30s'
				},
				network: {
					epochAdjustment: '1234'
				}
			};
			const txFees = { averageFeeMultiplier: 100, medianFeeMultiplier: 50 };
			const chainInfo = { height: '7654321' };
			const mosaicInfo = { names: ['XYM'], divisibility: 6 };

			mockMakeRequest
				.mockResolvedValueOnce(nodeInfo)
				.mockResolvedValueOnce(networkProps)
				.mockResolvedValueOnce(txFees)
				.mockResolvedValueOnce(chainInfo);
			mockApi.mosaic.fetchMosaicInfo.mockResolvedValueOnce(mosaicInfo);

			const expectedNetworkIdentifier = networkTypeToIdentifier(nodeInfo.networkIdentifier);
			const expectedMosaicId = '0xABCD\'EF01'.split('\'').join('').replace(/^(0x)/, '');

			const result = await networkService.fetchNetworkInfo(nodeUrl);

			expect(result).toEqual({
				nodeUrl,
				wsUrl: 'ws://api.symbol.node:3000/ws',
				networkIdentifier: expectedNetworkIdentifier,
				generationHash: 'GEN_HASH',
				chainHeight: 7654321,
				blockGenerationTargetTime: '30',
				epochAdjustment: 1234,
				transactionFees: txFees,
				networkCurrency: {
					name: 'XYM',
					mosaicId: expectedMosaicId,
					divisibility: 6
				}
			});

			expect(mockMakeRequest).toHaveBeenNthCalledWith(1, `${nodeUrl}/node/info`);
			expect(mockMakeRequest).toHaveBeenNthCalledWith(2, `${nodeUrl}/network/properties`);
			expect(mockMakeRequest).toHaveBeenNthCalledWith(3, `${nodeUrl}/network/fees/transaction`);
			expect(mockMakeRequest).toHaveBeenNthCalledWith(4, `${nodeUrl}/chain/info`);
			expect(mockApi.mosaic.fetchMosaicInfo).toHaveBeenCalledWith({ nodeUrl }, expectedMosaicId);
		});
	});

	describe('pingNode', () => {
		it('returns parsed chain height', async () => {
			const nodeUrl = 'http://api.symbol.node:3000';
			mockMakeRequest.mockResolvedValueOnce({ height: '42' });

			const height = await networkService.pingNode(nodeUrl);

			expect(height).toBe(42);
			expect(mockMakeRequest).toHaveBeenCalledWith(`${nodeUrl}/chain/info`);
		});
	});

	describe('fetchRentalFees', () => {
		it('returns relative amounts using network currency divisibility', async () => {
			const networkProperties = {
				nodeUrl: 'http://api.symbol.node:3000',
				networkCurrency: { divisibility: 6 }
			};
			const feesResponse = {
				effectiveMosaicRentalFee: '1000000',
				effectiveRootNamespaceRentalFeePerBlock: '1500000',
				effectiveChildNamespaceRentalFee: '500000'
			};
			mockMakeRequest.mockResolvedValueOnce(feesResponse);

			const result = await networkService.fetchRentalFees(networkProperties);

			expect(result).toEqual({
				mosaic: absoluteToRelativeAmount('1000000', 6),
				rootNamespacePerBlock: absoluteToRelativeAmount('1500000', 6),
				subNamespace: absoluteToRelativeAmount('500000', 6)
			});
			expect(mockMakeRequest).toHaveBeenCalledWith(`${networkProperties.nodeUrl}/network/fees/rental`);
		});
	});
});
