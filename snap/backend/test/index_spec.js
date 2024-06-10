import { onRpcRequest } from '../src/index.js';
import statisticsClient from '../src/services/statisticsClient.js';
import stateManager from '../src/stateManager.js';
import accountUtils from '../src/utils/accountUtils.js';
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
			accounts: {},
			network: mockNodeInfo
		});
	});

	describe('initialSnap', () => {
		const assertInitialSnap = async (state, expectedState) => {
			// Arrange:
			stateManager.getState.mockResolvedValue(state);
			statisticsClient.getNodeInfo.mockResolvedValue(mockNodeInfo);

			// Act:
			const response = await onRpcRequest({
				request: {
					method: 'initialSnap',
					params: {
						networkName: 'mainnet'
					}
				}
			});

			// Assert:
			expect(response).toStrictEqual(expectedState);
		};

		it('returns basic snap states', async () => {
			await assertInitialSnap(null, {
				accounts: {},
				network: mockNodeInfo
			});
		});

		it('returns snap states with accounts', async () => {
			// Arrange:
			const state = {
				accounts: {
					'0x1': {
						account: {
							id: '0x1',
							address: 'address',
							label: 'Primary Account',
							networkName: 'mainnet'
						},
						privateKey: 'private key'
					},
					'0x2': {
						account: {
							id: '0x2',
							address: 'address',
							label: 'Primary Account',
							networkName: 'testnet'
						},
						privateKey: 'private key'
					}
				},
				network: mockNodeInfo
			};

			await assertInitialSnap(state, {
				accounts: {
					'0x1': {
						id: '0x1',
						address: 'address',
						label: 'Primary Account',
						networkName: 'mainnet'
					}
				},
				network: mockNodeInfo
			});
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

	describe('createAccount', () => {
		it('returns new created account', async () => {
			// Arrange:
			jest.spyOn(accountUtils, 'createAccount').mockResolvedValue();

			// Act:
			await onRpcRequest({
				request: {
					method: 'createAccount',
					params: {
						walletLabel: 'my wallet'
					}
				}
			});

			// Assert:
			expect(accountUtils.createAccount).toHaveBeenCalledWith({
				state: {
					accounts: {},
					network: mockNodeInfo
				},
				requestParams: {
					walletLabel: 'my wallet'
				}
			});
		});
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
