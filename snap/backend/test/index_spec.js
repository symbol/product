import { onRpcRequest } from '../src/index.js';
import statisticsClient from '../src/services/statisticsClient.js';
import stateManager from '../src/stateManager.js';
import {
	describe, expect, it, jest
} from '@jest/globals';

jest.spyOn(stateManager, 'getState').mockResolvedValue();
jest.spyOn(stateManager, 'update').mockResolvedValue();
jest.spyOn(statisticsClient, 'getNodeInfo').mockResolvedValue();
global.snap = {
	request: jest.fn()
};

describe('onRpcRequest', () => {
	const mockNodeInfo = {
		identifier: 104,
		networkName: 'mainnet',
		url: 'http://localhost:3000'
	};

	beforeEach(() => {
		jest.clearAllMocks();

		stateManager.getState.mockResolvedValue({
			network: mockNodeInfo
		});
	});

	describe('initialize state', () => {
		it('set default network (mainnet) if state is empty', async () => {
			// Arrange:
			stateManager.getState.mockResolvedValue(null);
			statisticsClient.getNodeInfo.mockResolvedValue(mockNodeInfo);

			// Act:
			await onRpcRequest({
				request: {
					method: 'getNetwork'
				}
			});

			// Assert:
			expect(statisticsClient.getNodeInfo).toHaveBeenCalledWith('mainnet');
			expect(stateManager.update).toHaveBeenCalledWith({
				network: {
					...mockNodeInfo
				}
			});
		});

		it('does not set default network if state is not empty', async () => {
			// Act:
			await onRpcRequest({
				request: {
					method: 'getNetwork'
				}
			});

			// Assert:
			expect(statisticsClient.getNodeInfo).not.toHaveBeenCalled();
			expect(stateManager.update).not.toHaveBeenCalled();
		});
	});

	it('throws an error if the requested method does not exist', async () => {
		// Act + Assert:
		await expect(onRpcRequest({
			request: {
				method: 'unknownMethod'
			}
		})).rejects.toThrow('Method not found.');
	});

	describe('getNetwork', () => {
		it('returns the current network', async () => {
			// Act:
			const response = await onRpcRequest({
				request: {
					method: 'getNetwork'
				}
			});

			// Assert:
			expect(response).toStrictEqual(mockNodeInfo);
		});
	});

	describe('switchNetwork', () => {
		it('switches the network', async () => {
			// Arrange:
			const mockExpectedNodeInfo = {
				identifier: 152,
				networkName: 'testnet',
				url: 'http://localhost:3000'
			};

			statisticsClient.getNodeInfo.mockResolvedValue(mockExpectedNodeInfo);

			// Act:
			const response = await onRpcRequest({
				request: {
					method: 'switchNetwork',
					params: {
						networkName: 'testnet'
					}
				}
			});

			// Assert:
			expect(response).toStrictEqual(mockExpectedNodeInfo);
		});
	});
});
