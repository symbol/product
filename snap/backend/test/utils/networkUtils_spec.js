import statisticsClient from '../../src/services/statisticsClient.js';
import symbolClient from '../../src/services/symbolClient.js';
import stateManager from '../../src/stateManager.js';
import networkUtils from '../../src/utils/networkUtils.js';
import { describe, jest } from '@jest/globals';

jest.spyOn(statisticsClient, 'getNodeInfo').mockResolvedValue();
jest.spyOn(stateManager, 'update').mockResolvedValue();

describe('networkUtils', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('switchNetwork', () => {
		it('should switch network and fetch mosaic id when giving network name', async () => {
			// Arrange:
			const state = {
				network: {}
			};

			const requestParams = {
				networkName: 'testnet'
			};

			const mockNodeInfo = {
				identifier: 1,
				networkName: requestParams.networkName,
				url: 'http://localhost:3000'
			};
			const mockCurrencyMosaicId = 'mosaicId';

			statisticsClient.getNodeInfo.mockResolvedValue(mockNodeInfo);
			jest.spyOn(symbolClient, 'create').mockReturnValue({
				fetchNetworkCurrencyMosaicId: jest.fn().mockResolvedValue(mockCurrencyMosaicId)
			});

			// Act:
			const result = await networkUtils.switchNetwork({ state, requestParams });

			// Assert:
			const expectedResult = {
				...mockNodeInfo,
				currencyMosaicId: mockCurrencyMosaicId
			};

			expect(statisticsClient.getNodeInfo).toHaveBeenCalledWith(requestParams.networkName);
			expect(stateManager.update).toHaveBeenCalledWith({
				network: expectedResult
			});
			expect(result).toStrictEqual(expectedResult);
		});
	});
});
