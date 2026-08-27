import { MosaicService } from '../../src/api/MosaicService';
import { accountInfoResponse } from '../__fixtures__/api/account-info-response';
import { accountsSearchResponse } from '../__fixtures__/api/accounts-search-response';
import { mosaicInfosResponse } from '../__fixtures__/api/mosaic-infos-response';
import {
	mosaicCreatorAddress,
	mosaicHolderAddress,
	mosaicInfos,
	mosaicNames,
	mosaicOwners,
	supplyMutableMosaic
} from '../__fixtures__/local/mosaic';
import { namespaceInfoWithMosaicAlias } from '../__fixtures__/local/namespace';
import { networkProperties } from '../__fixtures__/local/network';
import { expect, jest } from '@jest/globals';
import { NotFoundError } from 'wallet-common-core';

const mockMakeRequest = jest.fn();
const mockApi = {
	namespace: {
		fetchNamespaceInfos: jest.fn(),
		fetchMosaicNames: jest.fn()
	}
};

const mosaicsEndpoint = `${networkProperties.nodeUrl}/mosaics`;
const heldMosaic = supplyMutableMosaic;
const mosaicAliasNamespaceId = namespaceInfoWithMosaicAlias.id;
const linkedMosaic = mosaicInfos[namespaceInfoWithMosaicAlias.linkedMosaicId];

const createMosaicInfosRequestConfig = mosaicIds => ({
	method: 'POST',
	body: JSON.stringify({ mosaicIds }),
	headers: {
		'Content-Type': 'application/json'
	}
});

const findMosaicInfosResponse = mosaicId => mosaicInfosResponse.filter(mosaicInfoDTO => mosaicInfoDTO.mosaic.id === mosaicId);

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
			const mosaicId = heldMosaic.id;
			mosaicService.fetchMosaicInfos = jest.fn().mockResolvedValue(mosaicInfos);
			const expectedResult = heldMosaic;

			// Act:
			const result = await mosaicService.fetchMosaicInfo(networkProperties, mosaicId);

			// Assert:
			expect(mosaicService.fetchMosaicInfos).toHaveBeenCalledWith(networkProperties, [mosaicId]);
			expect(result).toStrictEqual(expectedResult);
		});
	});

	describe('fetchMosaicInfos', () => {
		const runFetchMosaicInfosTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				config.mosaicsResponses.forEach(response => mockMakeRequest.mockResolvedValueOnce(response));
				config.namespaceInfosResponses.forEach(response => mockApi.namespace.fetchNamespaceInfos.mockResolvedValueOnce(response));
				config.mosaicNamesResponses.forEach(response => mockApi.namespace.fetchMosaicNames.mockResolvedValueOnce(response));

				// Act:
				const result = await mosaicService.fetchMosaicInfos(networkProperties, config.mosaicIds);

				// Assert:
				expect(mockMakeRequest).toHaveBeenCalledTimes(expected.requestedMosaicIds.length);
				expected.requestedMosaicIds.forEach((mosaicIds, index) => {
					expect(mockMakeRequest).toHaveBeenNthCalledWith(
						index + 1,
						mosaicsEndpoint,
						createMosaicInfosRequestConfig(mosaicIds)
					);
				});
				expect(result).toStrictEqual(expected.mosaicInfos);
			});
		};

		const fetchMosaicInfosTests = [
			{
				description: 'fetches mosaic infos for a list of mosaic ids',
				config: {
					mosaicIds: Object.keys(mosaicInfos),
					mosaicsResponses: [mosaicInfosResponse],
					namespaceInfosResponses: [{}],
					mosaicNamesResponses: [mosaicNames]
				},
				expected: {
					requestedMosaicIds: [Object.keys(mosaicInfos)],
					mosaicInfos
				}
			},
			{
				description: 'resolves a namespace id to the mosaic info of its linked mosaic',
				config: {
					mosaicIds: [mosaicAliasNamespaceId],
					// The namespace id has no mosaic info, the linked mosaic is fetched in a second round.
					mosaicsResponses: [[], findMosaicInfosResponse(linkedMosaic.id)],
					namespaceInfosResponses: [{ [mosaicAliasNamespaceId]: namespaceInfoWithMosaicAlias }, {}],
					mosaicNamesResponses: [{ [linkedMosaic.id]: linkedMosaic.names }, {}]
				},
				expected: {
					requestedMosaicIds: [[mosaicAliasNamespaceId], [linkedMosaic.id]],
					// The info is returned under both the namespace id and the linked mosaic id.
					mosaicInfos: {
						[mosaicAliasNamespaceId]: linkedMosaic,
						[linkedMosaic.id]: linkedMosaic
					}
				}
			}
		];

		fetchMosaicInfosTests.forEach(test => {
			runFetchMosaicInfosTest(test.description, test.config, test.expected);
		});
	});

	describe('fetchAccountMosaics', () => {
		const runFetchAccountMosaicsTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				mockMakeRequest.mockResolvedValueOnce({ data: config.mosaicsResponse });
				mockApi.namespace.fetchMosaicNames.mockResolvedValueOnce(config.mosaicNames);

				// Act:
				const result = await mosaicService.fetchAccountMosaics(networkProperties, mosaicCreatorAddress, config.searchCriteria);

				// Assert:
				expect(mockMakeRequest).toHaveBeenCalledWith(expected.endpoint);
				expect(mockApi.namespace.fetchMosaicNames).toHaveBeenCalledWith(networkProperties, expected.mosaicIds);
				expect(result).toStrictEqual(expected.mosaicInfos);
			});
		};

		const fetchAccountMosaicsTests = [
			{
				description: 'fetches the mosaics created by an account with the default search criteria',
				config: {
					mosaicsResponse: mosaicInfosResponse,
					mosaicNames
				},
				expected: {
					endpoint: `${mosaicsEndpoint}?pageNumber=1&pageSize=100&order=desc&ownerAddress=${mosaicCreatorAddress}`,
					mosaicIds: Object.keys(mosaicInfos),
					mosaicInfos: Object.values(mosaicInfos)
				}
			},
			{
				description: 'forwards the search criteria to the mosaics search url',
				config: {
					mosaicsResponse: mosaicInfosResponse,
					mosaicNames,
					searchCriteria: { pageNumber: 2, pageSize: 10, order: 'asc' }
				},
				expected: {
					endpoint: `${mosaicsEndpoint}?pageNumber=2&pageSize=10&order=asc&ownerAddress=${mosaicCreatorAddress}`,
					mosaicIds: Object.keys(mosaicInfos),
					mosaicInfos: Object.values(mosaicInfos)
				}
			},
			{
				description: 'returns an empty list when the account has not created any mosaic',
				config: {
					mosaicsResponse: [],
					mosaicNames: {}
				},
				expected: {
					endpoint: `${mosaicsEndpoint}?pageNumber=1&pageSize=100&order=desc&ownerAddress=${mosaicCreatorAddress}`,
					mosaicIds: [],
					mosaicInfos: []
				}
			}
		];

		fetchAccountMosaicsTests.forEach(test => {
			runFetchAccountMosaicsTest(test.description, test.config, test.expected);
		});
	});

	describe('fetchMosaicOwners', () => {
		const mosaicId = heldMosaic.id;
		const accountsEndpoint = `${networkProperties.nodeUrl}/accounts`;

		const runFetchMosaicOwnersTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				config.requestResponses.forEach(response => mockMakeRequest.mockResolvedValueOnce(response));

				// Act:
				const result = await mosaicService.fetchMosaicOwners(networkProperties, mosaicId, config.searchCriteria);

				// Assert:
				expect(mockMakeRequest).toHaveBeenCalledTimes(config.requestResponses.length);
				expect(mockMakeRequest).toHaveBeenNthCalledWith(1, expected.endpoint);
				expect(result).toStrictEqual(expected.mosaicOwners);
			});
		};

		const fetchMosaicOwnersTests = [
			{
				description: 'fetches the accounts holding a mosaic with their relative amounts',
				config: {
					requestResponses: [accountsSearchResponse, findMosaicInfosResponse(mosaicId)]
				},
				expected: {
					endpoint: `${accountsEndpoint}?pageNumber=1&pageSize=100&order=desc&mosaicId=${mosaicId}`,
					mosaicOwners
				}
			},
			{
				description: 'forwards the search criteria to the accounts search url',
				config: {
					requestResponses: [accountsSearchResponse, findMosaicInfosResponse(mosaicId)],
					searchCriteria: { pageNumber: 2, pageSize: 10, order: 'asc' }
				},
				expected: {
					endpoint: `${accountsEndpoint}?pageNumber=2&pageSize=10&order=asc&mosaicId=${mosaicId}`,
					mosaicOwners
				}
			},
			{
				description: 'returns an empty list without fetching the mosaic info when there are no holders',
				config: {
					requestResponses: [{ data: [] }]
				},
				expected: {
					endpoint: `${accountsEndpoint}?pageNumber=1&pageSize=100&order=desc&mosaicId=${mosaicId}`,
					mosaicOwners: []
				}
			}
		];

		fetchMosaicOwnersTests.forEach(test => {
			runFetchMosaicOwnersTest(test.description, test.config, test.expected);
		});

		it('sends the divisibility request as a mosaic infos request for the searched mosaic', async () => {
			// Arrange:
			mockMakeRequest
				.mockResolvedValueOnce(accountsSearchResponse)
				.mockResolvedValueOnce(findMosaicInfosResponse(mosaicId));
			const expectedRequestConfig = createMosaicInfosRequestConfig([mosaicId]);

			// Act:
			await mosaicService.fetchMosaicOwners(networkProperties, mosaicId);

			// Assert:
			expect(mockMakeRequest).toHaveBeenNthCalledWith(2, mosaicsEndpoint, expectedRequestConfig);
		});
	});

	describe('fetchMosaicOwner', () => {
		const mosaicId = heldMosaic.id;
		const address = mosaicHolderAddress;
		const accountEndpoint = `${networkProperties.nodeUrl}/accounts/${address}`;
		const accountWithoutMosaicResponse = { account: { mosaics: [] } };

		const runFetchMosaicOwnerTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				config.requestResponses.forEach(response => mockMakeRequest.mockResolvedValueOnce(response));

				// Act:
				const result = await mosaicService.fetchMosaicOwner(networkProperties, mosaicId, address);

				// Assert:
				expect(mockMakeRequest).toHaveBeenCalledTimes(config.requestResponses.length);
				expect(mockMakeRequest).toHaveBeenNthCalledWith(1, accountEndpoint);
				expect(result).toStrictEqual(expected.mosaicOwner);
			});
		};

		const fetchMosaicOwnerTests = [
			{
				description: 'fetches the held amount of the account in relative units',
				config: {
					requestResponses: [accountInfoResponse, findMosaicInfosResponse(mosaicId)]
				},
				expected: {
					mosaicOwner: { address, amount: '0.54' }
				}
			},
			{
				description: 'returns a zero amount without fetching the mosaic info when the account does not hold the mosaic',
				config: {
					requestResponses: [accountWithoutMosaicResponse]
				},
				expected: {
					mosaicOwner: { address, amount: '0' }
				}
			}
		];

		fetchMosaicOwnerTests.forEach(test => {
			runFetchMosaicOwnerTest(test.description, test.config, test.expected);
		});

		it('returns a zero amount when the account is unknown to the network', async () => {
			// Arrange:
			mockMakeRequest.mockRejectedValueOnce(new NotFoundError('Account not found'));

			// Act:
			const result = await mosaicService.fetchMosaicOwner(networkProperties, mosaicId, address);

			// Assert:
			expect(mockMakeRequest).toHaveBeenCalledTimes(1);
			expect(result).toStrictEqual({ address, amount: '0' });
		});

		it('rethrows other request errors', async () => {
			// Arrange:
			const requestError = new Error('Network unavailable');
			mockMakeRequest.mockRejectedValueOnce(requestError);

			// Act & Assert:
			await expect(mosaicService.fetchMosaicOwner(networkProperties, mosaicId, address)).rejects.toBe(requestError);
		});
	});
});
