import { apiNodeListResponse, emptyNodeListResponse, peerNodeListResponse } from '../../../../__fixtures__/api/symbol/node-list';
import { apiNodeList, emptyNodeList, nodeList, peerNodeList } from '../../../../__fixtures__/local/symbol/node-list';
import * as serverUtils from '@/app/utils/server';
import { fetchNodeList } from '@/app/variants/symbol/api/nodes';

// Mocks

jest.mock('@/app/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/utils/server')
	};
});

// Constants

const nodewatchPeerNodesURL = 'https://node.list/api/symbol/nodes/peer';
const nodewatchApiNodesURL = 'https://node.list/api/symbol/nodes/api';

// Tests

describe('variants/symbol/api/nodes', () => {
	describe('fetchNodeList', () => {
		it('requests both Symbol node lists once without query parameters', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(emptyNodeListResponse);

			// Act:
			await fetchNodeList();

			// Assert:
			expect(makeRequest.mock.calls).toEqual([[nodewatchPeerNodesURL], [nodewatchApiNodesURL]]);
		});

		it.each([
			['maps peer nodes followed by API-only nodes and preserves values', peerNodeListResponse, apiNodeListResponse, nodeList],
			['returns peer nodes when there are no API-only nodes', peerNodeListResponse, emptyNodeListResponse, peerNodeList],
			['returns API-only nodes when there are no peer nodes', emptyNodeListResponse, apiNodeListResponse, apiNodeList],
			['returns an empty list when both node lists are empty', emptyNodeListResponse, emptyNodeListResponse, emptyNodeList]
		])('%s', async (description, peerResponse, apiResponse, expected) => {
			// Arrange:
			jest.spyOn(serverUtils, 'makeRequest').mockImplementation(url =>
				Promise.resolve(url === nodewatchPeerNodesURL ? peerResponse : apiResponse));

			// Act:
			const result = await fetchNodeList();

			// Assert:
			expect(result).toStrictEqual(expected);
		});

		it.each([
			['peer', nodewatchPeerNodesURL],
			['API-only', nodewatchApiNodesURL]
		])('propagates a %s node-list request failure', async (description, failingURL) => {
			// Arrange:
			const error = new Error('Nodewatch request failed');
			jest.spyOn(serverUtils, 'makeRequest').mockImplementation(url => (
				url === failingURL ? Promise.reject(error) : Promise.resolve(peerNodeListResponse)
			));

			// Act + Assert:
			await expect(fetchNodeList()).rejects.toBe(error);
		});

		it.each([
			['peer', nodewatchPeerNodesURL],
			['API-only', nodewatchApiNodesURL]
		])('rejects a malformed %s node list response', async (description, failingURL) => {
			// Arrange:
			jest.spyOn(serverUtils, 'makeRequest').mockImplementation(url =>
				Promise.resolve(url === failingURL ? '' : peerNodeListResponse));

			// Act + Assert:
			await expect(fetchNodeList()).rejects.toThrow('Invalid Nodewatch node list response');
		});
	});
});
