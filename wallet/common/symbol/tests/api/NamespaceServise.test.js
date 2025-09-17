import { NamespaceService } from '../../src/api/NamespaceService';
import { createSearchUrl } from '../../src/utils';
import { mosaicNamesResponse } from '../__fixtures__/api/mosaic-names-response';
import { namespaceInfoWithAddressAliasResponse, namespaceInfoWithMosaicAliasResponse } from '../__fixtures__/api/namespace-info-response';
import { namespaceNamesResponse } from '../__fixtures__/api/namespace-names-response';
import { statementsResolutionAddressResponse } from '../__fixtures__/api/statements-resolution-address-response';
import { mosaicNames } from '../__fixtures__/local/mosaic';
import { namespaceInfoWithAddressAlias, namespaceInfoWithMosaicAlias, namespaceNames } from '../__fixtures__/local/namespace';
import { networkProperties } from '../__fixtures__/local/network';
import { describe, expect, jest } from '@jest/globals';
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
			const transactionLocation = { height: 1000, primaryId: Number.MAX_SAFE_INTEGER, secondaryId: Number.MAX_SAFE_INTEGER };
			mockMakeRequest.mockResolvedValueOnce(statementsResolutionAddressResponse);
			const expectedUrl = `${networkProperties.nodeUrl}/statements/resolutions/address?height=1000&pageSize=100`;
			const unresolvedAddressWithLocation = {
				namespaceId,
				location: transactionLocation
			};

			// Act & Assert:
			if (shouldThrow) {
				await expect(namespaceService.resolveAddressAtHeight(networkProperties, unresolvedAddressWithLocation))
					.rejects.toThrow(expectedResult);
			} else {
				const result = await namespaceService.resolveAddressAtHeight(networkProperties, unresolvedAddressWithLocation);
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

	describe('resolveAddresses', () => {
		it('resolves a mix of addresses using block statements and current alias', async () => {
			// Arrange:
			const input = [
				{
					namespaceId: 'FOUND_NS_AT_HEIGHT',
					location: { height: 1000, primaryId: 1, secondaryId: 0 }
				},
				{
					namespaceId: 'NON_EXISTENT_NS_AT_HEIGHT',
					location: { height: 1000, primaryId: 2, secondaryId: 0 }
				},
				{
					namespaceId: 'FOUND_NS_ALIAS'
				},
				{
					namespaceId: 'NON_EXISTENT_NS_ALIAS'
				}
			];
			const expectedResult = {
				FOUND_NS_AT_HEIGHT: 'ADDRESS_AT_HEIGHT',
				FOUND_NS_ALIAS: 'ADDRESS_FROM_ALIAS'
			};
			const resolveAddressAtHeightSpy = jest
				.spyOn(namespaceService, 'resolveAddressAtHeight')
				.mockResolvedValueOnce('ADDRESS_AT_HEIGHT')
				.mockRejectedValueOnce(new ApiError('Not found', 'error_unknown_account_name'));
			const resolveAddressSpy = jest
				.spyOn(namespaceService, 'resolveAddress')
				.mockResolvedValueOnce('ADDRESS_FROM_ALIAS')
				.mockRejectedValueOnce(new ApiError('Not found', 'error_unknown_account_name'));

			// Act:
			const result = await namespaceService.resolveAddresses(networkProperties, input);

			// Assert:
			expect(result).toStrictEqual(expectedResult);
			expect(resolveAddressAtHeightSpy).toHaveBeenCalledTimes(2);
			expect(resolveAddressAtHeightSpy).toHaveBeenCalledWith(networkProperties, input[0]);
			expect(resolveAddressAtHeightSpy).toHaveBeenCalledWith(networkProperties, input[1]);
			expect(resolveAddressSpy).toHaveBeenCalledTimes(2);
			expect(resolveAddressSpy).toHaveBeenCalledWith(networkProperties, input[2].namespaceId);
			expect(resolveAddressSpy).toHaveBeenCalledWith(networkProperties, input[3].namespaceId);
		});
	});

	describe('resolveAddress', () => {
		const runResolveAddressTest = async (
			fetchNamespaceInfoReturnValue,
			{ expectedResult, expectedError },
			namespaceId = 'D748B092093AA7A1'
		) => {
			// Arrange:
			const spy = jest.spyOn(namespaceService, 'fetchNamespaceInfo');

			if (fetchNamespaceInfoReturnValue instanceof Error) 
				spy.mockRejectedValueOnce(fetchNamespaceInfoReturnValue);
			else 
				spy.mockResolvedValueOnce(fetchNamespaceInfoReturnValue);
            

			// Act & Assert:
			if (expectedError) {
				await expect(namespaceService.resolveAddress(networkProperties, namespaceId)).rejects.toThrow(expectedError);
			} else {
				const result = await namespaceService.resolveAddress(networkProperties, namespaceId);
				expect(result).toBe(expectedResult);
			}

			expect(spy).toHaveBeenCalledWith(networkProperties, namespaceId);
		};

		it('returns address from namespace alias', async () => {
			// Arrange:
			const fetchNamespaceInfoReturnValue = namespaceInfoWithAddressAlias;
			const expectedResult = 'TALZP6U5S2YWPBVKHD3GY3NHYBVZEMSEFKXAGHY';

			// Act & Assert:
			await runResolveAddressTest(fetchNamespaceInfoReturnValue, { expectedResult });
		});

		it('throws error when no address alias found', async () => {
			// Arrange:
			const namespaceId = 'NO_ADDRESS_ALIAS_NS';
			const expectedError = new ApiError(
				`Linked address for namespace ${namespaceId} not found. No address alias found.`,
				'error_unknown_account_name'
			);
			const fetchNamespaceInfoReturnValue = namespaceInfoWithMosaicAlias;

			// Act & Assert:
			await runResolveAddressTest(fetchNamespaceInfoReturnValue, { expectedError }, namespaceId);
		});

		it('throws error when namespace not found', async () => {
			// Arrange:
			const namespaceId = 'MISSING_NAMESPACE';
			const fetchNamespaceInfoError = new Error('Not found');
			fetchNamespaceInfoError.code = 'error_fetch_not_found';
			const expectedError = new ApiError(
				`Linked address for namespace ${namespaceId} not found. Namespace does not exist.`,
				'error_unknown_account_name'
			);

			// Act & Assert:
			await runResolveAddressTest(fetchNamespaceInfoError, { expectedError }, namespaceId);
		});

		it('rethrows error when unknown error occurs', async () => {
			// Arrange:
			const namespaceId = 'ANY_NAMESPACE';
			const fetchNamespaceInfoError = new Error('network down');
			const expectedError = fetchNamespaceInfoError;

			await runResolveAddressTest(fetchNamespaceInfoError, { expectedError }, namespaceId);
		});
	});

	describe('fetchNamespaceInfo', () => {
		const runFetchNamespaceInfoTest = async (response, expectedResult) => {
			// Arrange:
			const namespaceId = 'D748B092093AA7A1';
			const expectedUrl = `${networkProperties.nodeUrl}/namespaces/${namespaceId}`;
			mockMakeRequest.mockResolvedValueOnce(response);
			jest.spyOn(namespaceService, 'fetchNamespaceNames').mockResolvedValueOnce(namespaceNames);

			// Act:
			const result = await namespaceService.fetchNamespaceInfo(networkProperties, namespaceId);

			// Assert:
			expect(mockMakeRequest).toHaveBeenCalledWith(expectedUrl);
			expect(result).toStrictEqual(expectedResult);
		};

		it('fetches namespace info with address alias', async () => {
			const response = namespaceInfoWithAddressAliasResponse;
			const expectedResult = namespaceInfoWithAddressAlias;

			await runFetchNamespaceInfoTest(response, expectedResult);
		});

		it('fetches namespace info with mosaic alias', async () => {
			const response = namespaceInfoWithMosaicAliasResponse;
			const expectedResult = namespaceInfoWithMosaicAlias;

			await runFetchNamespaceInfoTest(response, expectedResult);
		});
	});
});
