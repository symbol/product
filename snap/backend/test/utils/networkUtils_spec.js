import statisticsClient from '../../src/services/statisticsClient.js';
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
		it('should switch network when giving network name', async () => {
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

			statisticsClient.getNodeInfo.mockResolvedValue(mockNodeInfo);

			// Act:
			const result = await networkUtils.switchNetwork({ state, requestParams });

			// Assert:
			expect(statisticsClient.getNodeInfo).toHaveBeenCalledWith(requestParams.networkName);
			expect(stateManager.update).toHaveBeenCalledWith({ network: mockNodeInfo });
			expect(result).toStrictEqual(mockNodeInfo);
		});
	});
});
