import { emptyNodeListResponse, nodeListResponse } from '../../../../__fixtures__/api/symbol/node-list';
import { emptyNodeList, nodeList } from '../../../../__fixtures__/local/symbol/node-list';
import { runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
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

// Tests

describe('variants/symbol/api/nodes', () => {
	describe('fetchNodeList', () => {
		describe('request', () => {
			const requestCases = [
				{
					description: 'requests the Symbol peer-node list without query parameters',
					config: {},
					expected: { url: nodewatchPeerNodesURL }
				}
			];

			runApiRequestTests({
				functionToTest: fetchNodeList,
				response: emptyNodeListResponse,
				cases: requestCases
			});
		});

		describe('result', () => {
			const resultCases = [
				{
					description: 'maps peer nodes in response order and preserves values in the frontend shape',
					config: { response: nodeListResponse },
					expected: { result: nodeList }
				},
				{
					description: 'returns an empty list when Nodewatch returns no peer nodes',
					config: { response: emptyNodeListResponse },
					expected: { result: emptyNodeList }
				}
			];

			runApiResultTests({ functionToTest: fetchNodeList, cases: resultCases });
		});

		it('propagates a Nodewatch request failure', async () => {
			// Arrange:
			const error = new Error('Nodewatch request failed');
			const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockRejectedValue(error);

			// Act + Assert:
			await expect(fetchNodeList()).rejects.toBe(error);
			expect(makeRequest).toHaveBeenCalledWith(nodewatchPeerNodesURL);
		});
	});
});
