import { nodeList } from '../../../../__fixtures__/local/symbol/node-list';
import * as nodesService from '@/app/variants/symbol/api/nodes';
import { fetchNodeStats } from '@/app/variants/symbol/api/stats';

jest.mock('@/app/variants/symbol/api/nodes', () => ({
	__esModule: true,
	...jest.requireActual('@/app/variants/symbol/api/nodes')
}));

describe('variants/symbol/api/stats', () => {
	describe('fetchNodeStats', () => {
		it.each([
			['all returned nodes, including repeated entries', [...nodeList, nodeList[0]], 4],
			['an empty list', [], 0]
		])('counts %s and returns no supernode count', async (description, nodes, total) => {
			// Arrange:
			jest.spyOn(nodesService, 'fetchNodeList').mockResolvedValue(nodes);

			// Act:
			const result = await fetchNodeStats();

			// Assert:
			expect(result).toStrictEqual({ total, supernodes: null });
		});

		it('propagates node-list errors without a fallback', async () => {
			// Arrange:
			const error = new Error('Node list unavailable');
			jest.spyOn(nodesService, 'fetchNodeList').mockRejectedValue(error);

			// Act + Assert:
			await expect(fetchNodeStats()).rejects.toBe(error);
		});
	});
});
