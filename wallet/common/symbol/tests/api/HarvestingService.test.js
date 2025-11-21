import { HarvestingService } from '../../src/api/HarvestingService';
import { HarvestingStatus } from '../../src/constants';
import { createSearchUrl, networkTypeToIdentifier } from '../../src/utils';
import { statementsTransactionHarvestingResponse } from '../__fixtures__/api/statements-transaction-harvesting-response';
import { harvestedBlocks } from '../__fixtures__/local/harvesting';
import { networkProperties } from '../__fixtures__/local/network';
import { currentAccount } from '../__fixtures__/local/wallet';
import { runApiTest } from '../test-utils';
import { expect, jest } from '@jest/globals';

describe('HarvestingService', () => {
	let harvestingService;
	let mockMakeRequest;
	let mockApi;

	const { address, publicKey } = currentAccount;
	const nodewatchBaseUrl = 'https://nodewatch.net';
	const baseConfig = {
		nodewatchURL: {
			[networkProperties.networkIdentifier]: nodewatchBaseUrl
		}
	};

	beforeEach(() => {
		mockMakeRequest = jest.fn();
		mockApi = {
			network: {
				pingNode: jest.fn()
			}
		};
		harvestingService = new HarvestingService({
			api: mockApi,
			config: baseConfig,
			makeRequest: mockMakeRequest
		});

		jest.clearAllMocks();
	});

	describe('fetchStatus', () => {
		const runFetchStatusTest = async ({ accountApiResponse, nodeOperatorResponse }, expectedResult) => {
			// Arrange:
			const accountUrl = `${networkProperties.nodeUrl}/accounts/${address}`;
			const operatorUrl = `${nodewatchBaseUrl}/api/symbol/nodes/mainPublicKey/${publicKey}`;
			const apiCalls = [
				{ url: accountUrl, options: undefined, response: accountApiResponse }
			];

			if (nodeOperatorResponse)
				apiCalls.push({ url: operatorUrl, options: undefined, response: nodeOperatorResponse });

			const functionToTest = () => harvestingService.fetchStatus(networkProperties, currentAccount);

			// Act & Assert:
			await runApiTest(mockMakeRequest, functionToTest, apiCalls, expectedResult);
		};

		it('returns OPERATOR when keys are not linked and the account public key is a node key', async () => {
			// Arrange:
			const accountApiResponse = {
				account: {
					supplementalPublicKeys: {}
				}
			};
			const nodeUrl = 'https://node.operator:3001';
			const nodeOperatorResponse = { endpoint: nodeUrl };
			const expectedResult = { status: HarvestingStatus.OPERATOR, nodeUrl };

			// Act & Assert:
			await runFetchStatusTest({ accountApiResponse, nodeOperatorResponse }, expectedResult);
		});

		it('returns INACTIVE when keys are not linked and account is not a node operator', async () => {
			// Arrange:
			const accountApiResponse = {
				account: { supplementalPublicKeys: {} }
			};
			const expectedResult = { status: HarvestingStatus.INACTIVE };

			// Act & Assert:
			await runFetchStatusTest({ accountApiResponse, nodeOperatorResponse: undefined }, expectedResult);
		});

		it('returns ACTIVE when all keys linked and account is unlocked on node', async () => {
			// Arrange:
			const linkedPublicKey = 'LINKED_PK';
			const nodePublicKey = 'NODE_PK';
			const vrfPublicKey = 'VRF_PK';
			const accountApiResponse = {
				account: {
					supplementalPublicKeys: {
						linked: { publicKey: linkedPublicKey },
						node: { publicKey: nodePublicKey },
						vrf: { publicKey: vrfPublicKey }
					}
				}
			};
			const nodeUrl = 'https://harvest.node:3001';
			const nodeInfoUrl = `${nodewatchBaseUrl}/api/symbol/nodes/nodePublicKey/${nodePublicKey}`;
			const unlockedUrl = `${nodeUrl}/node/unlockedaccount`;
			const apiCalls = [
				{ 
					url: `${networkProperties.nodeUrl}/accounts/${address}`, 
					options: undefined, 
					response: accountApiResponse 
				},
				{ 
					url: nodeInfoUrl, 
					options: undefined, 
					response: { endpoint: nodeUrl } 
				},
				{ 
					url: unlockedUrl, 
					options: undefined, 
					response: { unlockedAccount: [linkedPublicKey] } 
				}
			];

			const functionToTest = () => harvestingService.fetchStatus(networkProperties, currentAccount);
			const expectedResult = { status: HarvestingStatus.ACTIVE, nodeUrl };

			// Act & Assert:
			await runApiTest(mockMakeRequest, functionToTest, apiCalls, expectedResult);
		});

		it('returns PENDING when all keys linked but account is not unlocked on node', async () => {
			// Arrange:
			const linkedPublicKey = 'LINKED_PK';
			const nodePublicKey = 'NODE_PK';
			const vrfPublicKey = 'VRF_PK';
			const accountApiResponse = {
				account: {
					supplementalPublicKeys: {
						linked: { publicKey: linkedPublicKey },
						node: { publicKey: nodePublicKey },
						vrf: { publicKey: vrfPublicKey }
					}
				}
			};
			const nodeUrl = 'https://harvest.node:3001';
			const nodeInfoUrl = `${nodewatchBaseUrl}/api/symbol/nodes/nodePublicKey/${nodePublicKey}`;
			const unlockedUrl = `${nodeUrl}/node/unlockedaccount`;
			const apiCalls = [
				{ 
					url: `${networkProperties.nodeUrl}/accounts/${address}`, 
					options: undefined, 
					response: accountApiResponse 
				},
				{ 
					url: nodeInfoUrl, 
					options: undefined, 
					response: { 
						endpoint: nodeUrl
					} 
				},
				{ 
					url: unlockedUrl, 
					options: undefined, 
					response: { 
						unlockedAccount: ['OTHER_PK'] 
					} 
				}
			];
			const functionToTest = () => harvestingService.fetchStatus(networkProperties, currentAccount);
			const expectedResult = { status: HarvestingStatus.PENDING, nodeUrl };

			// Act & Assert:
			await runApiTest(mockMakeRequest, functionToTest, apiCalls, expectedResult);
		});

		it('returns NODE_UNKNOWN if node info is not available from statistics service', async () => {
			// Arrange:
			const linkedPublicKey = 'LINKED_PK';
			const nodePublicKey = 'NODE_PK';
			const vrfPublicKey = 'VRF_PK';
			const accountApiResponse = {
				account: {
					supplementalPublicKeys: {
						linked: { publicKey: linkedPublicKey },
						node: { publicKey: nodePublicKey },
						vrf: { publicKey: vrfPublicKey }
					}
				}
			};
			const apiCalls = [
				{ url: `${networkProperties.nodeUrl}/accounts/${address}`, options: undefined, response: accountApiResponse }
			];
			const functionToTest = () => harvestingService.fetchStatus(networkProperties, currentAccount);
			const expectedResult = { status: HarvestingStatus.NODE_UNKNOWN };

			// Act & Assert:
			await runApiTest(mockMakeRequest, functionToTest, apiCalls, expectedResult);
		});
	});

	describe('fetchSummary', () => {
		const runFetchSummaryTest = async ({
			chainHeight,
			pages
		}, expectedResult) => {
			// Arrange:
			mockApi.network.pingNode.mockResolvedValueOnce(chainHeight);
			const spyFetchHarvestedBlocks = jest
				.spyOn(harvestingService, 'fetchHarvestedBlocks')
				.mockImplementation(async (_np, _addr, { pageNumber }) => pages[pageNumber - 1] || []);

			const functionToTest = () => harvestingService.fetchSummary(networkProperties, address);

			// Act & Assert:
			await runApiTest(mockMakeRequest, functionToTest, [], expectedResult);

			// Also verify fetchHarvestedBlocks was invoked multiple times
			expect(spyFetchHarvestedBlocks).toHaveBeenCalled();
		};

		it('computes summary from harvested blocks within last 30 days', async () => {
			// Arrange:
			const chainHeight = 100_000;
			const recent1 = { height: 100_000, amount: '12.3456', timestamp: 1000 };
			const recent2 = { height: 99_999, amount: '3.3333', timestamp: 2000 };
			const older = { height: 13_000, amount: '10', timestamp: 3000 };
			const pages = [
				[recent1, recent2],
				[older]
			];
			const expectedResult = {
				latestAmount: recent1.amount,
				latestHeight: recent1.height,
				latestDate: recent1.timestamp,
				amountPer30Days: '15.6789',
				blocksHarvestedPer30Days: 2
			};

			// Act & Assert:
			await runFetchSummaryTest({ chainHeight, pages }, expectedResult);
		});

		it('returns zeros when no harvested blocks in last 30 days', async () => {
			// Arrange:
			const chainHeight = 1_000;
			const pages = [[]];
			const expectedResult = {
				latestAmount: 0,
				latestHeight: null,
				latestDate: null,
				amountPer30Days: 0,
				blocksHarvestedPer30Days: 0
			};

			// Act & Assert:
			await runFetchSummaryTest({ chainHeight, pages, blockAtHeightResponse: undefined }, expectedResult);
		});
	});

	describe('fetchHarvestedBlocks', () => {
		it('builds search URL and maps harvested block receipts to amounts and dates', async () => {
			// Arrange:
			const receiptType = 8515;
			const searchCriteria = { pageNumber: 1, pageSize: 20, order: 'desc' };
			const expectedUrl = createSearchUrl(
				networkProperties.nodeUrl,
				'/statements/transaction',
				searchCriteria,
				{ receiptType, targetAddress: address }
			);
			const expectedResult = harvestedBlocks;
			const functionToTest = () =>
				harvestingService.fetchHarvestedBlocks(networkProperties, address, searchCriteria);

			// Act & Assert:
			await runApiTest(
				mockMakeRequest,
				functionToTest,
				[
					{
						url: expectedUrl,
						options: undefined,
						response: statementsTransactionHarvestingResponse
					}
				],
				expectedResult
			);
		});
	});

	describe('fetchNodeList', () => {
		it('fetches nodes', async () => {
			// Arrange:
			const {networkIdentifier} = networkProperties;
			const baseUrl = baseConfig.nodewatchURL[networkIdentifier];
			const endpoint = `${baseUrl}/api/symbol/nodes/peer?only_ssl=true`;
			const nodesResponse = [
				{ endpoint: 'https://dual-1:3001' },
				{ endpoint: 'https://dual-2:3001' }
			];
			const expectedResult = nodesResponse.map(n => n.endpoint);

			const functionToTest = () => harvestingService.fetchNodeList(networkIdentifier);

			// Act & Assert:
			await runApiTest(
				mockMakeRequest,
				functionToTest,
				[{ url: endpoint, options: undefined, response: nodesResponse }],
				expectedResult
			);
		});
	});

	describe('fetchNodeInfo', () => {
		it('fetches node info and maps network type to identifier', async () => {
			// Arrange:
			const nodeUrl = 'https://node.info:3000';
			const endpoint = `${nodeUrl}/node/info`;
			const nodePublicKey = 'NODE_PUBLIC_KEY';
			const rawNetworkType = 152;
			const response = { nodePublicKey, networkIdentifier: rawNetworkType };
			const expectedResult = {
				nodePublicKey,
				networkIdentifier: networkTypeToIdentifier(rawNetworkType)
			};

			const functionToTest = () => harvestingService.fetchNodeInfo(nodeUrl);

			// Act & Assert:
			await runApiTest(
				mockMakeRequest,
				functionToTest,
				[{ url: endpoint, options: undefined, response }],
				expectedResult
			);
		});
	});
});
