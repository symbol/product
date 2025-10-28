import { MosaicService } from '../../src/api/MosaicService';
import { mosaicInfosResponse } from '../__fixtures__/api/mosaic-infos-response';
import { mosaicInfos, mosaicNames } from '../__fixtures__/local/mosaic';
import { networkProperties } from '../__fixtures__/local/network';
import { expect, jest } from '@jest/globals';

const mockMakeRequest = jest.fn();
const mockApi = {
	namespace: {
		fetchNamespaceInfos: jest.fn(),
		fetchMosaicNames: jest.fn()
	}
};

describe('MosaicService', () => {
	let mosaicService;

	beforeEach(() => {
		jest.clearAllMocks();
		mosaicService = new MosaicService({
			api: mockApi,
			makeRequest: mockMakeRequest
		});
	});

	describe('fetchMosaicInfo', () => {
		it('fetches a single mosaic info by calling fetchMosaicInfos', async () => {
			// Arrange:
			const mosaicId = '72C0212E67A08BCE';
			mosaicService.fetchMosaicInfos = jest.fn().mockResolvedValue(mosaicInfos);

			// Act:
			const result = await mosaicService.fetchMosaicInfo(networkProperties, mosaicId);

			// Assert:
			expect(mosaicService.fetchMosaicInfos).toHaveBeenCalledWith(networkProperties, [mosaicId]);
			expect(result).toStrictEqual(mosaicInfos[mosaicId]);
		});
	});

	describe('fetchMosaicInfos', () => {
		it('fetches mosaic infos for a list of ids', async () => {
			// Arrange:
			const mosaicIds = Object.keys(mosaicInfos);
			mockMakeRequest.mockResolvedValueOnce(mosaicInfosResponse);
			mockApi.namespace.fetchNamespaceInfos.mockResolvedValueOnce({});
			mockApi.namespace.fetchMosaicNames.mockResolvedValueOnce(mosaicNames);
			const expectedResult = mosaicInfos;
			const expectedRequestConfig = {
				method: 'POST',
				body: JSON.stringify({
					mosaicIds
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			};

			// Act:
			const result = await mosaicService.fetchMosaicInfos(networkProperties, mosaicIds);

			// Assert:
			expect(mockMakeRequest).toHaveBeenCalledWith(`${networkProperties.nodeUrl}/mosaics`, expectedRequestConfig);
			expect(result).toStrictEqual(expectedResult);
		});
	});
});
