import { addressFromRaw, createSearchUrl, getTokenAmount, tokenInfoFromDTO } from '../utils';
import _ from 'lodash';
import { NotFoundError, absoluteToRelativeAmount } from 'wallet-common-core';

/** @typedef {import('../types/Token').TokenInfo} TokenInfo */
/** @typedef {import('../types/Token').TokenOwner} TokenOwner */
/** @typedef {import('../types/Token').MosaicDTO} MosaicDTO */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/SearchCriteria').SearchCriteria} SearchCriteria */

export class TokenService {
	#api;
	#makeRequest;

	constructor(options) {
		this.#api = options.api;
		this.#makeRequest = options.makeRequest;
	}

	/**
	 * Fetches token info from the node.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} tokenId - Requested token id.
	 * @returns {Promise<TokenInfo>} - The token info.
	 */
	fetchTokenInfo = async (networkProperties, tokenId) => {
		const tokenInfos = await this.fetchTokenInfos(networkProperties, [tokenId]);

		return tokenInfos[tokenId];
	};

	/**
	 * Fetches token infos for the list of ids from the node.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string[]} tokenIds - Requested token ids.
	 * @returns {Promise<Record<string, TokenInfo>>} - The token infos map.
	 */
	fetchTokenInfos = async (networkProperties, tokenIds) => {
		// Fetch token infos from API
		const endpoint = `${networkProperties.nodeUrl}/mosaics`;
		const payload = {
			mosaicIds: tokenIds
		};
		const data = await this.#makeRequest(endpoint, {
			method: 'POST',
			body: JSON.stringify(payload),
			headers: {
				'Content-Type': 'application/json'
			}
		});

		// Create map <id, info> from response
		const tokenInfoEntries = data.map(mosaicInfoDTO => [
			mosaicInfoDTO.mosaic.id,
			tokenInfoFromDTO(mosaicInfoDTO.mosaic)
		]);
		const tokenInfos = Object.fromEntries(tokenInfoEntries);

		// Find namespace ids if there are some in the token list. Token infos are not available for namespace ids
		const fetchedTokenIds = Object.keys(tokenInfos);
		const namespaceIds = _.difference(tokenIds, fetchedTokenIds);

		// Fetch namespace infos to extract token ids from there
		const namespaceInfos = await this.#api.namespace.fetchNamespaceInfos(networkProperties, namespaceIds);
		const remainedTokenIds = Object.values(namespaceInfos).map(namespaceInfo => namespaceInfo.linkedTokenId);
		const shouldFetchRemainedTokenInfos = remainedTokenIds.length > 0;

		// Fetch remained token infos for extracted tokens from namespace infos
		const remainedTokenInfos = shouldFetchRemainedTokenInfos
			? await this.fetchTokenInfos(networkProperties, remainedTokenIds)
			: {};

		// Fetch token names
		const tokenIdsToFetchNames = _.difference(tokenIds, namespaceIds);
		const tokenNames = await this.#api.namespace.fetchTokenNames(networkProperties, tokenIdsToFetchNames);

		for (const tokenId in tokenNames)
			tokenInfos[tokenId].names = tokenNames[tokenId];


		for (const namespaceId of namespaceIds) {
			if (namespaceInfos[namespaceId]) {
				const tokenId = namespaceInfos[namespaceId].linkedTokenId;
				tokenInfos[namespaceId] = remainedTokenInfos[tokenId];
			}
		}

		return { ...tokenInfos, ...remainedTokenInfos };
	};

	/**
	 * Fetches the list of tokens created by a given account from the node.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} address - The token creator address.
	 * @param {SearchCriteria} [searchCriteria] - Search criteria.
	 * @returns {Promise<TokenInfo[]>} - The created tokens.
	 */
	fetchCreatedTokens = async (networkProperties, address, searchCriteria) => {
		const endpoint = createSearchUrl(networkProperties.nodeUrl, '/mosaics', searchCriteria, {
			ownerAddress: address
		});
		const { data } = await this.#makeRequest(endpoint);
		const tokenInfos = data.map(mosaicDTO => tokenInfoFromDTO(mosaicDTO.mosaic));
		const tokenIds = tokenInfos.map(tokenInfo => tokenInfo.id);
		const tokenNames = await this.#api.namespace.fetchTokenNames(networkProperties, tokenIds);

		return tokenInfos.map(tokenInfo => ({
			...tokenInfo,
			names: tokenNames[tokenInfo.id] || []
		}));
	};

	/**
	 * Fetches the list of accounts holding a given token from the node.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} tokenId - The token id to search holders for.
	 * @param {SearchCriteria} [searchCriteria] - Search criteria.
	 * @returns {Promise<TokenOwner[]>} - The token owners with their held amounts in relative units.
	 */
	fetchTokenOwners = async (networkProperties, tokenId, searchCriteria) => {
		const endpoint = createSearchUrl(networkProperties.nodeUrl, '/accounts', searchCriteria, {
			mosaicId: tokenId
		});
		const { data } = await this.#makeRequest(endpoint);

		if (!data.length)
			return [];

		const divisibility = await this.#fetchTokenDivisibility(networkProperties, tokenId);

		return data.map(accountDTO => ({
			address: addressFromRaw(accountDTO.account.address),
			amount: absoluteToRelativeAmount(getTokenAmount(accountDTO.account.mosaics, tokenId), divisibility)
		}));
	};

	/**
	 * Fetches the balance of a given token held by an account from the node. An account unknown
	 * to the network holds nothing, so a zero balance is returned instead of failing.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} tokenId - The token id.
	 * @param {string} address - The account address.
	 * @returns {Promise<string>} - The held amount in relative units.
	 */
	fetchTokenBalance = async (networkProperties, tokenId, address) => {
		const tokens = await this.#fetchAccountTokens(networkProperties, address);
		const absoluteAmount = getTokenAmount(tokens, tokenId);

		if (absoluteAmount === '0')
			return '0';

		const divisibility = await this.#fetchTokenDivisibility(networkProperties, tokenId);

		return absoluteToRelativeAmount(absoluteAmount, divisibility);
	};

	/**
	 * Fetches the tokens held by an account from the node, treating an account unknown to the network as holding none.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} address - The account address.
	 * @returns {Promise<MosaicDTO[]>} - The held tokens in absolute units.
	 */
	#fetchAccountTokens = async (networkProperties, address) => {
		const endpoint = `${networkProperties.nodeUrl}/accounts/${address}`;

		try {
			const { account } = await this.#makeRequest(endpoint);

			return account.mosaics;
		} catch (error) {
			if (error instanceof NotFoundError || error.statusCode === 404)
				return [];

			throw error;
		}
	};

	/**
	 * Fetches the divisibility of a single token directly from the node, skipping name and namespace resolution.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} tokenId - The token id.
	 * @returns {Promise<number>} - The token divisibility.
	 */
	#fetchTokenDivisibility = async (networkProperties, tokenId) => {
		const endpoint = `${networkProperties.nodeUrl}/mosaics`;
		const [mosaicInfoDTO] = await this.#makeRequest(endpoint, {
			method: 'POST',
			body: JSON.stringify({ mosaicIds: [tokenId] }),
			headers: {
				'Content-Type': 'application/json'
			}
		});

		return mosaicInfoDTO.mosaic.divisibility;
	};
}
