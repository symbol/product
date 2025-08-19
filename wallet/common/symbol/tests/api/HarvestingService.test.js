import { HarvestingService } from '../../src/api/HarvestingService';
import { HarvestingStatus } from '../../src/constants';
import { createSearchUrl, networkTimestampToUnix, networkTypeToIdentifier } from '../../src/utils';
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
	const statisticsServiceBaseUrl = 'http://stats.example.tld';
	const baseConfig = {
		statisticsServiceURL: {
			[networkProperties.networkIdentifier]: statisticsServiceBaseUrl
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
			const operatorUrl = `${statisticsServiceBaseUrl}/nodes/${publicKey}`;
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
			const nodeUrl = 'http://node.operator:3000';
			const nodeOperatorResponse = { apiStatus: { restGatewayUrl: nodeUrl } };
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
			const nodeUrl = 'http://harvest.node:3000';
			const nodeInfoUrl = `${statisticsServiceBaseUrl}/nodes/nodePublicKey/${nodePublicKey}`;
			const unlockedUrl = `${nodeUrl}/node/unlockedaccount`;
			const apiCalls = [
				{ url: `${networkProperties.nodeUrl}/accounts/${address}`, options: undefined, response: accountApiResponse },
				{ url: nodeInfoUrl, options: undefined, response: { apiStatus: { restGatewayUrl: nodeUrl } } },
				{ url: unlockedUrl, options: undefined, response: { unlockedAccount: [linkedPublicKey] } }
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
			const nodeUrl = 'http://harvest.node:3000';
			const nodeInfoUrl = `${statisticsServiceBaseUrl}/nodes/nodePublicKey/${nodePublicKey}`;
			const unlockedUrl = `${nodeUrl}/node/unlockedaccount`;

			const apiCalls = [
				{ url: `${networkProperties.nodeUrl}/accounts/${address}`, options: undefined, response: accountApiResponse },
				{ url: nodeInfoUrl, options: undefined, response: { apiStatus: { restGatewayUrl: nodeUrl } } },
				{ url: unlockedUrl, options: undefined, response: { unlockedAccount: ['OTHER_PK'] } }
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
			pages,
			blockAtHeightResponse
		}, expectedResult) => {
			// Arrange:
			mockApi.network.pingNode.mockResolvedValueOnce(chainHeight);
			const spyFetchHarvestedBlocks = jest
				.spyOn(harvestingService, 'fetchHarvestedBlocks')
				.mockImplementation(async (_np, _addr, { pageNumber }) => pages[pageNumber - 1] || []);
			const blockUrl = `${networkProperties.nodeUrl}/blocks/${expectedResult.latestHeight}`;
			const apiCalls = expectedResult.latestHeight
				? [{ url: blockUrl, options: undefined, response: blockAtHeightResponse }]
				: [];

			const functionToTest = () => harvestingService.fetchSummary(networkProperties, address);

			// Act & Assert:
			await runApiTest(mockMakeRequest, functionToTest, apiCalls, expectedResult);

			// Also verify fetchHarvestedBlocks was invoked multiple times
			expect(spyFetchHarvestedBlocks).toHaveBeenCalled();
		};

		it('computes summary from harvested blocks within last 30 days', async () => {
			// Arrange:
			const chainHeight = 100_000;
			const recent1 = { height: 100_000, amount: 12.3456 };
			const recent2 = { height: 99_999, amount: 3.3333 };
			const older = { height: 13_000, amount: 10 };
			const pages = [
				[recent1, recent2],
				[older]
			];
			const blockAtHeightResponse = { block: { timestamp: '0' } };
			const latestAmount = recent1.amount.toFixed(2);
			const latestHeight = recent1.height;
			const latestDate = networkTimestampToUnix(0, networkProperties.epochAdjustment);
			const amountPer30Days = (recent1.amount + recent2.amount).toFixed(2);
			const blocksHarvestedPer30Days = 2;
			const expectedResult = {
				latestAmount,
				latestHeight,
				latestDate,
				amountPer30Days,
				blocksHarvestedPer30Days
			};

			// Act & Assert:
			await runFetchSummaryTest({ chainHeight, pages, blockAtHeightResponse }, expectedResult);
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
		it('fetches suggested nodes and maps to restGatewayUrl', async () => {
			// Arrange:
			const {networkIdentifier} = networkProperties;
			const baseUrl = baseConfig.statisticsServiceURL[networkIdentifier];
			const endpoint = `${baseUrl}/nodes?filter=suggested&ssl=true`;
			const nodesResponse = [
				{ apiStatus: { restGatewayUrl: 'http://dual-1:3000' } },
				{ apiStatus: { restGatewayUrl: 'http://dual-2:3000' } }
			];
			const expectedResult = nodesResponse.map(n => n.apiStatus.restGatewayUrl);

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
			const nodeUrl = 'http://node.info:3000';
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
