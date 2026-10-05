import {
	tokenIdFromRaw,
	tokenIdToRaw,
	tokenInfoFromDTO,
	tokenListFromDTO
} from '../utils';
import { NotFoundError } from 'wallet-common-core';

/** @typedef {import('../types/Token').Token} Token */
/** @typedef {import('../types/Token').RawToken} RawToken */
/** @typedef {import('../types/Token').TokenInfo} TokenInfo */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */

export class TokenService {
	#makeRequest;

	constructor(options) {
		this.#makeRequest = options.makeRequest;
	}

	/**
	 * Fetches token info for a single token ID.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} tokenId - The token id ('namespace.name').
	 * @returns {Promise<TokenInfo>} The token info, or undefined when the token is unknown.
	 */
	fetchTokenInfo = async (networkProperties, tokenId) => {
		const tokenInfos = await this.fetchTokenInfos(networkProperties, [tokenId]);

		return tokenInfos[tokenId];
	};

	/**
	 * Fetches token infos for a list of token IDs.
	 * Groups IDs by namespace and queries /mosaic/definition/page per namespace.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string[]} tokenIds - The token ids to resolve.
	 * @returns {Promise<Record<string, TokenInfo>>} The token infos keyed by id (not-found ids omitted; other failures propagate).
	 */
	fetchTokenInfos = async (networkProperties, tokenIds) => {
		if (!tokenIds.length)
			return {};

		const namespaceGroups = tokenIds.reduce((groups, id) => {
			const { namespaceId } = tokenIdToRaw(id);
			(groups[namespaceId] ??= []).push(id);
			
			return groups;
		}, {});

		const tokenInfos = {};

		const fetchNamespaceDefinitions = Object.entries(namespaceGroups).map(async ([namespaceId, ids]) => {
			const endpoint = `${networkProperties.nodeUrl}/namespace/mosaic/definition/page?namespace=${namespaceId}&pageSize=100`;

			let response;
			try {
				response = await this.#makeRequest(endpoint);
			} catch (error) {
				if (error instanceof NotFoundError || error.statusCode === 404)
					return;

				throw error;
			}

			for (const wrapper of (response.data || [])) {
				const definition = wrapper.mosaic || wrapper;
				const id = tokenIdFromRaw(definition.id);

				if (!ids.includes(id))
					continue;

				tokenInfos[id] = tokenInfoFromDTO(definition);
			}
		});
		await Promise.all(fetchNamespaceDefinitions);

		return tokenInfos;
	};

	/**
	 * Fetches owned tokens for an account.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} address - The account address.
	 * @returns {Promise<Array<Token | RawToken>>} The account's tokens with resolved amounts and metadata.
	 */
	fetchAccountTokens = async (networkProperties, address) => {
		const mosaicsDTO = await this.#makeRequest(`${networkProperties.nodeUrl}/account/mosaic/owned?address=${address}`);
		const ownedMosaics = mosaicsDTO.data || [];

		// Resolve definitions for the owned token ids by their namespace. The native currency (nem.xem) has
		// no on-chain mosaic definition, so seed its info from networkProperties.networkCurrency.
		const tokenIds = ownedMosaics.map(mosaic => tokenIdFromRaw(mosaic.mosaicId));
		const tokenInfos = await this.fetchTokenInfos(networkProperties, tokenIds);

		const { id: nativeId, name: nativeName, divisibility: nativeDivisibility } = networkProperties.networkCurrency;
		if (tokenIds.includes(nativeId) && !tokenInfos[nativeId])
			tokenInfos[nativeId] = { id: nativeId, name: nativeName, divisibility: nativeDivisibility };

		return tokenListFromDTO(ownedMosaics, tokenInfos);
	};
}

