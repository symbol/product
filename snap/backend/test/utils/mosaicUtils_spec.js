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

			const mosaicIds = ['mosaicId1', 'mosaicId2'];

			const mockFetchMosaicsInfo = jest.fn().mockResolvedValue({
				mosaicId1: { divisibility: 6 }
			});

			jest.spyOn(symbolClient, 'create').mockImplementation(() => ({
				fetchMosaicsInfo: mockFetchMosaicsInfo
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
						networkName: 'testnet'
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

		it('throw error if failed to update mosaic info', async () => {
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

			const client = {
				fetchMosaicsInfo: jest.fn().mockRejectedValue(new Error('error'))
			};

			jest.spyOn(symbolClient, 'create').mockReturnValue(client);

			// Act + Assert:
			await expect(mosaicUtils.updateMosaicInfo(state, mosaicIds)).rejects.toThrow('Failed to update mosaic info: error');
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
						networkName: 'testnet'
					},
					mosaicId2: {
						networkName: 'mainnet'
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
				mosaicId1: { networkName: 'testnet' }
			});
		});

		it('returns mosaic info from state filter by mainnet', () => {
			assertMosaicInfoFilterByNetworkName('mainnet', {
				mosaicId2: { networkName: 'mainnet' }
			});
		});
	});
});
