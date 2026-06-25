import { chainHeightResponse, networkTimeResponse, nodeInfoResponse, nodeListResponse } from '../__fixtures__/api/network-dtos';
import { networkInfo, networkProperties } from '../__fixtures__/local/network';
import { runApiServiceTest } from '../test-utils';

// Constants

const NODE_URL = networkProperties.nodeUrl;
const NETWORK_IDENTIFIER = networkProperties.networkIdentifier;
const NODEWATCH_URL = 'https://nodewatch.example';
const config = { nodewatchURL: { [NETWORK_IDENTIFIER]: NODEWATCH_URL } };

describe('api/NetworkService', () => {
	describe('fetchNetworkInfo', () => {
		it('aggregates the node, chain and time responses into the network info', async () => {
			// Arrange:
			const requestMap = {
				[`${NODE_URL}/node/info`]: nodeInfoResponse,
				[`${NODE_URL}/chain/height`]: chainHeightResponse,
				[`${NODE_URL}/time-sync/network-time`]: networkTimeResponse
			};

			// Act & Assert:
			await runApiServiceTest({
				requestMap,
				call: api => api.network.fetchNetworkInfo(NODE_URL),
				expected: networkInfo
			});
		});
	});

	describe('fetchNodeList', () => {
		it('fetches the SSL peer nodes and maps them to their endpoints', async () => {
			// Arrange:
			const endpoint = `${NODEWATCH_URL}/api/nem/nodes/peer?only_ssl=true&limit=30&order=random`;
			const requestMap = { [endpoint]: nodeListResponse };
			const expectedNodes = nodeListResponse.map(node => node.endpoint);

			// Act & Assert:
			await runApiServiceTest({
				requestMap,
				config,
				call: api => api.network.fetchNodeList(NETWORK_IDENTIFIER),
				expected: expectedNodes
			});
		});
	});

	describe('pingNode', () => {
		it('returns the parsed chain height', async () => {
			// Arrange:
			const requestMap = { [`${NODE_URL}/chain/height`]: chainHeightResponse };

			// Act & Assert:
			await runApiServiceTest({
				requestMap,
				call: api => api.network.pingNode(NODE_URL),
				expected: Number(chainHeightResponse.height)
			});
		});
	});
});
