import { TokenService } from '../../src/api/TokenService';
import { accountInfoResponse } from '../__fixtures__/api/account-info-response';
import { accountsSearchResponse } from '../__fixtures__/api/accounts-search-response';
import { tokenInfosResponse } from '../__fixtures__/api/token-infos-response';
import { namespaceInfoWithMosaicAlias } from '../__fixtures__/local/namespace';
import { networkProperties } from '../__fixtures__/local/network';
import {
	supplyMutableToken,
	tokenCreatorAddress,
	tokenHolderAddress,
	tokenInfos,
	tokenNames,
	tokenOwners
} from '../__fixtures__/local/token';
import { expect, jest } from '@jest/globals';
import { NotFoundError } from 'wallet-common-core';

const mockMakeRequest = jest.fn();
const mockApi = {
	namespace: {
		fetchNamespaceInfos: jest.fn(),
		fetchTokenNames: jest.fn()
	}
};

const mosaicsEndpoint = `${networkProperties.nodeUrl}/mosaics`;
const heldToken = supplyMutableToken;
const mosaicAliasNamespaceId = namespaceInfoWithMosaicAlias.id;
const linkedToken = tokenInfos[namespaceInfoWithMosaicAlias.linkedTokenId];

const createMosaicInfosRequestConfig = mosaicIds => ({
	method: 'POST',
	body: JSON.stringify({ mosaicIds }),
	headers: {
		'Content-Type': 'application/json'
	}
});

const findMosaicInfosResponse = tokenId => tokenInfosResponse.filter(mosaicInfoDTO => mosaicInfoDTO.mosaic.id === tokenId);

describe('TokenService', () => {
	let tokenService;

	beforeEach(() => {
		jest.clearAllMocks();
		tokenService = new TokenService({
			api: mockApi,
			makeRequest: mockMakeRequest
		});
	});

	describe('fetchTokenInfo', () => {
		it('fetches a single token info by calling fetchTokenInfos', async () => {
			// Arrange:
			const tokenId = heldToken.id;
			tokenService.fetchTokenInfos = jest.fn().mockResolvedValue(tokenInfos);
			const expectedResult = heldToken;

			// Act:
			const result = await tokenService.fetchTokenInfo(networkProperties, tokenId);

			// Assert:
			expect(tokenService.fetchTokenInfos).toHaveBeenCalledWith(networkProperties, [tokenId]);
			expect(result).toStrictEqual(expectedResult);
		});
	});

	describe('fetchTokenInfos', () => {
		const runFetchTokenInfosTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				config.mosaicsResponses.forEach(response => mockMakeRequest.mockResolvedValueOnce(response));
				config.namespaceInfosResponses.forEach(response => mockApi.namespace.fetchNamespaceInfos.mockResolvedValueOnce(response));
				config.tokenNamesResponses.forEach(response => mockApi.namespace.fetchTokenNames.mockResolvedValueOnce(response));

				// Act:
				const result = await tokenService.fetchTokenInfos(networkProperties, config.tokenIds);

				// Assert:
				expect(mockMakeRequest).toHaveBeenCalledTimes(expected.requestedTokenIds.length);
				expected.requestedTokenIds.forEach((tokenIds, index) => {
					expect(mockMakeRequest).toHaveBeenNthCalledWith(
						index + 1,
						mosaicsEndpoint,
						createMosaicInfosRequestConfig(tokenIds)
					);
				});
				expect(result).toStrictEqual(expected.tokenInfos);
			});
		};

		const fetchTokenInfosTests = [
			{
				description: 'fetches token infos for a list of token ids',
				config: {
					tokenIds: Object.keys(tokenInfos),
					mosaicsResponses: [tokenInfosResponse],
					namespaceInfosResponses: [{}],
					tokenNamesResponses: [tokenNames]
				},
				expected: {
					requestedTokenIds: [Object.keys(tokenInfos)],
					tokenInfos
				}
			},
			{
				description: 'resolves a namespace id to the token info of its linked token',
				config: {
					tokenIds: [mosaicAliasNamespaceId],
					// The namespace id has no token info, the linked token is fetched in a second round.
					mosaicsResponses: [[], findMosaicInfosResponse(linkedToken.id)],
					namespaceInfosResponses: [{ [mosaicAliasNamespaceId]: namespaceInfoWithMosaicAlias }, {}],
					tokenNamesResponses: [{ [linkedToken.id]: linkedToken.names }, {}]
				},
				expected: {
					requestedTokenIds: [[mosaicAliasNamespaceId], [linkedToken.id]],
					// The info is returned under both the namespace id and the linked token id.
					tokenInfos: {
						[mosaicAliasNamespaceId]: linkedToken,
						[linkedToken.id]: linkedToken
					}
				}
			}
		];

		fetchTokenInfosTests.forEach(test => {
			runFetchTokenInfosTest(test.description, test.config, test.expected);
		});
	});

	describe('fetchCreatedTokens', () => {
		const runFetchCreatedTokensTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				mockMakeRequest.mockResolvedValueOnce({ data: config.mosaicsResponse });
				mockApi.namespace.fetchTokenNames.mockResolvedValueOnce(config.tokenNames);

				// Act:
				const result = await tokenService.fetchCreatedTokens(networkProperties, tokenCreatorAddress, config.searchCriteria);

				// Assert:
				expect(mockMakeRequest).toHaveBeenCalledWith(expected.endpoint);
				expect(mockApi.namespace.fetchTokenNames).toHaveBeenCalledWith(networkProperties, expected.tokenIds);
				expect(result).toStrictEqual(expected.tokenInfos);
			});
		};

		const fetchCreatedTokensTests = [
			{
				description: 'fetches the tokens created by an account with the default search criteria',
				config: {
					mosaicsResponse: tokenInfosResponse,
					tokenNames
				},
				expected: {
					endpoint: `${mosaicsEndpoint}?pageNumber=1&pageSize=100&order=desc&ownerAddress=${tokenCreatorAddress}`,
					tokenIds: Object.keys(tokenInfos),
					tokenInfos: Object.values(tokenInfos)
				}
			},
			{
				description: 'forwards the search criteria to the mosaics search url',
				config: {
					mosaicsResponse: tokenInfosResponse,
					tokenNames,
					searchCriteria: { pageNumber: 2, pageSize: 10, order: 'asc' }
				},
				expected: {
					endpoint: `${mosaicsEndpoint}?pageNumber=2&pageSize=10&order=asc&ownerAddress=${tokenCreatorAddress}`,
					tokenIds: Object.keys(tokenInfos),
					tokenInfos: Object.values(tokenInfos)
				}
			},
			{
				description: 'returns an empty list when the account has not created any token',
				config: {
					mosaicsResponse: [],
					tokenNames: {}
				},
				expected: {
					endpoint: `${mosaicsEndpoint}?pageNumber=1&pageSize=100&order=desc&ownerAddress=${tokenCreatorAddress}`,
					tokenIds: [],
					tokenInfos: []
				}
			}
		];

		fetchCreatedTokensTests.forEach(test => {
			runFetchCreatedTokensTest(test.description, test.config, test.expected);
		});
	});

	describe('fetchTokenOwners', () => {
		const tokenId = heldToken.id;
		const accountsEndpoint = `${networkProperties.nodeUrl}/accounts`;

		const runFetchTokenOwnersTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				config.requestResponses.forEach(response => mockMakeRequest.mockResolvedValueOnce(response));

				// Act:
				const result = await tokenService.fetchTokenOwners(networkProperties, tokenId, config.searchCriteria);

				// Assert:
				expect(mockMakeRequest).toHaveBeenCalledTimes(config.requestResponses.length);
				expect(mockMakeRequest).toHaveBeenNthCalledWith(1, expected.endpoint);
				expect(result).toStrictEqual(expected.tokenOwners);
			});
		};

		const fetchTokenOwnersTests = [
			{
				description: 'fetches the accounts holding a token with their relative amounts',
				config: {
					requestResponses: [accountsSearchResponse, findMosaicInfosResponse(tokenId)]
				},
				expected: {
					endpoint: `${accountsEndpoint}?pageNumber=1&pageSize=100&order=desc&mosaicId=${tokenId}`,
					tokenOwners
				}
			},
			{
				description: 'forwards the search criteria to the accounts search url',
				config: {
					requestResponses: [accountsSearchResponse, findMosaicInfosResponse(tokenId)],
					searchCriteria: { pageNumber: 2, pageSize: 10, order: 'asc' }
				},
				expected: {
					endpoint: `${accountsEndpoint}?pageNumber=2&pageSize=10&order=asc&mosaicId=${tokenId}`,
					tokenOwners
				}
			},
			{
				description: 'returns an empty list without fetching the token info when there are no holders',
				config: {
					requestResponses: [{ data: [] }]
				},
				expected: {
					endpoint: `${accountsEndpoint}?pageNumber=1&pageSize=100&order=desc&mosaicId=${tokenId}`,
					tokenOwners: []
				}
			}
		];

		fetchTokenOwnersTests.forEach(test => {
			runFetchTokenOwnersTest(test.description, test.config, test.expected);
		});

		it('sends the divisibility request as a mosaic infos request for the searched token', async () => {
			// Arrange:
			mockMakeRequest
				.mockResolvedValueOnce(accountsSearchResponse)
				.mockResolvedValueOnce(findMosaicInfosResponse(tokenId));
			const expectedRequestConfig = createMosaicInfosRequestConfig([tokenId]);

			// Act:
			await tokenService.fetchTokenOwners(networkProperties, tokenId);

			// Assert:
			expect(mockMakeRequest).toHaveBeenNthCalledWith(2, mosaicsEndpoint, expectedRequestConfig);
		});
	});

	describe('fetchTokenBalance', () => {
		const tokenId = heldToken.id;
		const address = tokenHolderAddress;
		const accountEndpoint = `${networkProperties.nodeUrl}/accounts/${address}`;
		const accountWithoutMosaicResponse = { account: { mosaics: [] } };

		const runFetchTokenBalanceTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				config.requestResponses.forEach(response => mockMakeRequest.mockResolvedValueOnce(response));

				// Act:
				const result = await tokenService.fetchTokenBalance(networkProperties, tokenId, address);

				// Assert:
				expect(mockMakeRequest).toHaveBeenCalledTimes(config.requestResponses.length);
				expect(mockMakeRequest).toHaveBeenNthCalledWith(1, accountEndpoint);
				expect(result).toBe(expected.balance);
			});
		};

		const fetchTokenBalanceTests = [
			{
				description: 'fetches the held amount of the account in relative units',
				config: {
					requestResponses: [accountInfoResponse, findMosaicInfosResponse(tokenId)]
				},
				expected: {
					balance: '0.54'
				}
			},
			{
				description: 'returns a zero balance without fetching the token info when the account does not hold the token',
				config: {
					requestResponses: [accountWithoutMosaicResponse]
				},
				expected: {
					balance: '0'
				}
			}
		];

		fetchTokenBalanceTests.forEach(test => {
			runFetchTokenBalanceTest(test.description, test.config, test.expected);
		});

		it('returns a zero balance when the account is unknown to the network', async () => {
			// Arrange:
			mockMakeRequest.mockRejectedValueOnce(new NotFoundError('Account not found'));

			// Act:
			const result = await tokenService.fetchTokenBalance(networkProperties, tokenId, address);

			// Assert:
			expect(mockMakeRequest).toHaveBeenCalledTimes(1);
			expect(result).toBe('0');
		});

		it('rethrows other request errors', async () => {
			// Arrange:
			const requestError = new Error('Network unavailable');
			mockMakeRequest.mockRejectedValueOnce(requestError);

			// Act & Assert:
			await expect(tokenService.fetchTokenBalance(networkProperties, tokenId, address)).rejects.toBe(requestError);
		});
	});
});
