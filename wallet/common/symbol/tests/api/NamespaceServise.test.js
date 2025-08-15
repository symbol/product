import { NamespaceService } from '../../src/api/NamespaceService';
import { createSearchUrl } from '../../src/utils';
import { mosaicNamesResponse } from '../__fixtures__/api/mosaic-names-response';
import { namespaceNamesResponse } from '../__fixtures__/api/namespace-names-response';
import { statementsResolutionAddressResponse } from '../__fixtures__/api/statements-resolution-address-response';
import { mosaicNames } from '../__fixtures__/local/mosaic';
import { namespaceNames } from '../__fixtures__/local/namespace';
import { networkProperties } from '../__fixtures__/local/network';
import { expect, jest } from '@jest/globals';
import { ApiError } from 'wallet-common-core';

const mockMakeRequest = jest.fn();

describe('NamespaceService', () => {
	let namespaceService;

	beforeEach(() => {
		jest.clearAllMocks();
		namespaceService = new NamespaceService({
			makeRequest: mockMakeRequest
		});
	});

	describe('fetchAccountNamespaces', () => {
		it('fetches namespaces registered by a given account', async () => {
			// Arrange:
			const address = 'TALICE5XYY25WTSKCWGY5D3OVYLH2OABNQ';
			const searchCriteria = { pageSize: 100 };
			mockMakeRequest.mockResolvedValueOnce({ data: [] });
			const expectedNamespaces = [];
			mockMakeRequest.mockResolvedValueOnce(namespaceNamesResponse);
			const expectedResult = expectedNamespaces.map(namespaceDTO => namespaceFromDTO(namespaceDTO, namespaceNames));
			const expectedUrl = createSearchUrl(networkProperties.nodeUrl, '/namespaces', searchCriteria, {
				ownerAddress: address
			});

			// Act:
			const result = await namespaceService.fetchAccountNamespaces(networkProperties, address, searchCriteria);

			// Assert:
			expect(mockMakeRequest).toHaveBeenCalledWith(expectedUrl);
			expect(result).toStrictEqual(expectedResult);
		});
	});

	describe('fetchMosaicNames', () => {
		it('fetches mosaic names for a given list of mosaic ids', async () => {
			// Arrange:
			const mosaicIds = Object.keys(mosaicNames);
			mockMakeRequest.mockResolvedValueOnce(mosaicNamesResponse);
			const expectedResult = mosaicNames;
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
			const result = await namespaceService.fetchMosaicNames(networkProperties, mosaicIds);

			// Assert:
			expect(mockMakeRequest).toHaveBeenCalledWith(`${networkProperties.nodeUrl}/namespaces/mosaic/names`, expectedRequestConfig);
			expect(result).toStrictEqual(expectedResult);
		});
	});

	describe('fetchNamespaceNames', () => {
		it('fetches namespace names for a given list of namespace ids', async () => {
			// Arrange:
			const namespaceIds = Object.keys(namespaceNames);
			mockMakeRequest.mockResolvedValueOnce(namespaceNamesResponse);
			const expectedResult = namespaceNames;
			const expectedRequestConfig = {
				method: 'POST',
				body: JSON.stringify({
					namespaceIds
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			};

			// Act:
			const result = await namespaceService.fetchNamespaceNames(networkProperties, namespaceIds);

			// Assert:
			expect(mockMakeRequest).toHaveBeenCalledWith(`${networkProperties.nodeUrl}/namespaces/names`, expectedRequestConfig);
			expect(result).toStrictEqual(expectedResult);
		});
	});

	describe('resolveAddressAtHeight', () => {
		const runResolveAddressAtHeightTest = async (namespaceId, expectedResult, shouldThrow = false) => {
			// Arrange:
			const height = 1000;
			mockMakeRequest.mockResolvedValueOnce(statementsResolutionAddressResponse);
			const expectedUrl = `${networkProperties.nodeUrl}/statements/resolutions/address?height=${height}&pageSize=100`;

			// Act & Assert:
			if (shouldThrow) {
				await expect(namespaceService.resolveAddressAtHeight(networkProperties, namespaceId, height))
					.rejects.toThrow(expectedResult);
			} else {
				const result = await namespaceService.resolveAddressAtHeight(networkProperties, namespaceId, height);
				expect(result).toStrictEqual(expectedResult);
			}
			expect(mockMakeRequest).toHaveBeenCalledWith(expectedUrl);
		};

		it('fetches the address linked to a namespace id at a given height', async () => {
			// Arrange:
			const namespaceId = 'F6CAC3ABA3C2E158';
			const expectedResult = 'TAWGTICRU4V7XYY25WTSKCWGY5D3OVYLH2OABNQ';

			// Act & Assert:
			await runResolveAddressAtHeightTest(namespaceId, expectedResult);
		});

		it('throws an error if the namespace id is not found in the resolution statements', async () => {
			// Arrange:
			const namespaceId = 'AACAC3ABA3C2E1AA';
			const expectedError = new ApiError(`Failed to resolve address. Statement for ${namespaceId} not found at height 1000`);

			// Act & Assert:
			await runResolveAddressAtHeightTest(namespaceId, expectedError, true);
		});
	});
});
