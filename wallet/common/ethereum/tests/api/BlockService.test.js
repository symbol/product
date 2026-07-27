import { BlockService } from '../../src/api/BlockService';
import { jest } from '@jest/globals';
import { ethers } from 'ethers';

// Fixtures

// The node answered and refused to serve the block. Ethers cannot classify the JSON-RPC error and
// exposes it untouched on the thrown error.
const prunedBlockError = Object.assign(new Error('could not coalesce error'), {
	code: 'UNKNOWN_ERROR',
	error: {
		code: -32000,
		message: 'old data not available due to pruning: requested block 200, history is available from block 150'
	}
});

// The node was never reached, so there is no JSON-RPC error to inspect.
const unreachableNodeError = Object.assign(new Error('could not detect network'), {
	code: 'NETWORK_ERROR'
});

describe('api/BlockService', () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	describe('fetchBlockInfo', () => {
		it('returns block info for a given height', async () => {
			// Arrange:
			const networkProperties = { nodeUrl: 'http://localhost:8545' };
			const height = '123';
			const mockBlock = {
				number: 123,
				hash: '0xabc123',
				timestamp: 1700000000 // seconds
			};
			jest.spyOn(ethers.JsonRpcProvider.prototype, 'getBlock')
				.mockResolvedValue(mockBlock);

			// Act:
			const service = new BlockService();
			const result = await service.fetchBlockInfo(networkProperties, height);

			// Assert:
			expect(result).toStrictEqual({
				height: '123',
				hash: '0xabc123',
				timestamp: 1700000000 * 1000
			});
		});

		it('throws when block is not found', async () => {
			// Arrange:
			const networkProperties = { nodeUrl: 'http://localhost:8545' };
			const height = '999';
			jest.spyOn(ethers.JsonRpcProvider.prototype, 'getBlock')
				.mockResolvedValue(null);

			// Act & Assert:
			const service = new BlockService();
			await expect(service.fetchBlockInfo(networkProperties, height))
				.rejects.toThrow(`Block not found at height ${height}`);
		});
	});

	describe('fetchBlockInfos', () => {
		it('returns a map of block infos keyed by height, skipping missing blocks', async () => {
			// Arrange:
			const networkProperties = { nodeUrl: 'http://localhost:8545' };
			const heights = ['100', '200', '300'];
			const mockGetBlock = jest.spyOn(ethers.JsonRpcProvider.prototype, 'getBlock')
				.mockImplementation(async tag => {
					if (tag === 100n) 
						return { number: 100, hash: '0xhash100', timestamp: 1600000000 };
                    
					if (tag === 200n) 
						return null; // missing
                    
					if (tag === 300n) 
						return { number: 300, hash: '0xhash300', timestamp: 1600000100 };
                    
					return null;
				});

			// Act:
			const service = new BlockService();
			const result = await service.fetchBlockInfos(networkProperties, heights);

			// Assert:
			expect(mockGetBlock).toHaveBeenCalledTimes(3);
			expect(result).toStrictEqual({
				'100': { height: '100', hash: '0xhash100', timestamp: 1600000000 * 1000 },
				'300': { height: '300', hash: '0xhash300', timestamp: 1600000100 * 1000 }
			});
		});

		it('skips blocks the node refuses to serve instead of failing the whole batch', async () => {
			// Arrange: the node answers with a JSON-RPC error for the pruned height only.
			const networkProperties = { nodeUrl: 'http://localhost:8545' };
			const heights = ['100', '200'];
			jest.spyOn(ethers.JsonRpcProvider.prototype, 'getBlock')
				.mockImplementation(async tag => {
					if (tag === 200n)
						throw prunedBlockError;

					return { number: 100, hash: '0xhash100', timestamp: 1600000000 };
				});

			// Act:
			const service = new BlockService();
			const result = await service.fetchBlockInfos(networkProperties, heights);

			// Assert:
			expect(result).toStrictEqual({
				'100': { height: '100', hash: '0xhash100', timestamp: 1600000000 * 1000 }
			});
		});

		it('propagates a failure to reach the node instead of reporting the blocks as missing', async () => {
			// Arrange: an unreachable node carries no JSON-RPC error, so the data is unknown rather
			// than absent and must not be silently dropped.
			const networkProperties = { nodeUrl: 'http://localhost:8545' };
			const heights = ['100', '200'];
			jest.spyOn(ethers.JsonRpcProvider.prototype, 'getBlock')
				.mockRejectedValue(unreachableNodeError);

			// Act & Assert:
			const service = new BlockService();
			await expect(service.fetchBlockInfos(networkProperties, heights))
				.rejects.toThrow(unreachableNodeError);
		});
	});
});
