import statisticsClient from '../../src/services/statisticsClient.js';
import fetchUtils from '../../src/utils/fetchUtils.js';
import { describe, expect, jest } from '@jest/globals';

jest.spyOn(fetchUtils, 'fetchData').mockImplementation();

describe('statisticsClient', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('getNodeInfo', () => {
		it('should fetch node info successfully', async () => {
			// Arrange:
			const networkName = 'mainnet';
			const nodes = [{
				networkIdentifier: 1,
				apiStatus: {
					restGatewayUrl: 'http://localhost:3000'
				}
			}];

			fetchUtils.fetchData.mockResolvedValue(nodes);

			// Act:
			const result = await statisticsClient.getNodeInfo(networkName);

			// Assert:
			expect(result).toStrictEqual({
				identifier: nodes[0].networkIdentifier,
				networkName,
				url: nodes[0].apiStatus.restGatewayUrl
			});
			expect(fetchUtils.fetchData).toHaveBeenCalledWith('https://symbol.services/nodes??filter=suggested&limit=1&ssl=true', 'GET');
		});

		it('should throw an error when network is not provided', async () => {
			await expect(statisticsClient.getNodeInfo()).rejects.toThrow('Network is required');
		});

		it('should throw an error when fetch fails', async () => {
			// Arrange:
			fetchUtils.fetchData.mockRejectedValue(new Error('Failed to fetch'));

			// Assert:
			const errorMessage = 'Failed to fetch nodes from statistics service: Failed to fetch';
			await expect(statisticsClient.getNodeInfo('mainnet')).rejects.toThrow(errorMessage);
		});
	});
});
