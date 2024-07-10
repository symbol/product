import symbolClient from '../../src/services/symbolClient.js';
import stateManager from '../../src/stateManager.js';
import mosaicUtils from '../../src/utils/mosaicUtils.js';
import { beforeEach, describe, jest } from '@jest/globals';

global.snap = {
	request: jest.fn()
};

jest.spyOn(stateManager, 'update').mockResolvedValue();

describe('mosaicUtils', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('updateMosaicInfo', () => {
		it('should update mosaic info in state if given mosaic ids not exist in mosaicInfo', async () => {
			// Arrange:
			const state = {
				network: {
					url: 'http://localhost:3000',
					networkName: 'testnet'
				},
				mosaicInfo: {}
			};

			const mosaicIds = ['mosaicId1'];

			const mockFetchMosaicsInfo = jest.fn().mockResolvedValue({
				mosaicId1: { divisibility: 6 }
			});

			const mockFetchMosaicNamespace = jest.fn().mockResolvedValue({
				mosaicId1: ['namespace1']
			});

			jest.spyOn(symbolClient, 'create').mockImplementation(() => ({
				fetchMosaicsInfo: mockFetchMosaicsInfo,
				fetchMosaicNamespace: mockFetchMosaicNamespace
			}));

			// Act:
			await mosaicUtils.updateMosaicInfo(state, mosaicIds);

			// Assert:
			expect(mockFetchMosaicsInfo).toHaveBeenCalledWith(mosaicIds);
			expect(stateManager.update).toHaveBeenCalledWith({
				network: state.network,
				mosaicInfo: {
					mosaicId1: {
						divisibility: 6,
						networkName: 'testnet',
						name: ['namespace1']
					}
				}
			});
		});

		it('skip updating mosaic info in state if all given mosaic ids exist in mosaicInfo', async () => {
			// Arrange:
			const state = {
				network: {
					url: 'http://localhost:3000',
					networkName: 'testnet'
				},
				mosaicInfo: {
					mosaicId1: {
						divisibility: 6,
						networkName: 'testnet'
					}
				}
			};

			const mosaicIds = ['mosaicId1'];

			// Act:
			await mosaicUtils.updateMosaicInfo(state, mosaicIds);

			// Assert:
			expect(stateManager.update).not.toHaveBeenCalled();
		});

		const assertUpdateMosaicInfoThrowError = async (mockClient, errorMessage) => {
			// Arrange:
			const state = {
				network: {
					url: 'http://localhost:3000',
					networkName: 'testnet'
				},
				mosaicInfo: {
					mosaicId1: { networkName: 'testnet' }
				}
			};

			const mosaicIds = ['mosaicId2'];

			jest.spyOn(symbolClient, 'create').mockReturnValue(mockClient);

			// Act + Assert:
			await expect(mosaicUtils.updateMosaicInfo(state, mosaicIds)).rejects.toThrow(errorMessage);
		};

		it('throw error if client fetch mosaics info fail', async () => {
			// Arrange:
			const client = {
				fetchMosaicsInfo: jest.fn().mockRejectedValue(new Error('error')),
				fetchMosaicNamespace: jest.fn().mockResolvedValue({})
			};

			await assertUpdateMosaicInfoThrowError(client, 'Failed to update mosaic info: error');
		});

		it('throw error if client fetch mosaic namespace fail', async () => {
			// Arrange:
			const client = {
				fetchMosaicsInfo: jest.fn().mockResolvedValue({}),
				fetchMosaicNamespace: jest.fn().mockRejectedValue(new Error('error'))
			};

			await assertUpdateMosaicInfoThrowError(client, 'Failed to update mosaic info: error');
		});
	});

	describe('getMosaicInfo', () => {
		const assertMosaicInfoFilterByNetworkName = (networkName, expectedResult) => {
			// Arrange:
			const state = {
				network: {
					networkName
				},
				mosaicInfo: {
					mosaicId1: {
						networkName: 'testnet',
						name: ['namespace1']
					},
					mosaicId2: {
						networkName: 'mainnet',
						name: ['namespace2']
					}
				}
			};

			// Act:
			const mosaicInfo = mosaicUtils.getMosaicInfo({ state });

			// Assert:
			expect(mosaicInfo).toStrictEqual(expectedResult);
		};

		it('returns mosaic info from state filter by testnet', () => {
			assertMosaicInfoFilterByNetworkName('testnet', {
				mosaicId1: {
					networkName: 'testnet',
					name: ['namespace1']
				}
			});
		});

		it('returns mosaic info from state filter by mainnet', () => {
			assertMosaicInfoFilterByNetworkName('mainnet', {
				mosaicId2: {
					networkName: 'mainnet',
					name: ['namespace2']
				}
			});
		});
	});
});
