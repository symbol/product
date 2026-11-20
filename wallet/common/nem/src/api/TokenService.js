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
	 * Maps mosaic definitions to token infos. A supply-mutable token gets its current supply from the node.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {object[]} definitions - The mosaic definition DTOs.
	 * @returns {Promise<Record<string, TokenInfo>>} The token infos keyed by id.
	 */
	#resolveTokenInfos = async (networkProperties, definitions) => {
		const { nodeUrl, networkIdentifier } = networkProperties;
		const tokenInfos = await Promise.all(definitions.map(async definition => {
			const tokenInfo = tokenInfoFromDTO(definition, networkIdentifier);

			if (!tokenInfo.isSupplyMutable)
				return tokenInfo;

			const { namespaceId, name } = definition.id;
			try {
				const { supply } = await this.#makeRequest(`${nodeUrl}/mosaic/supply?mosaicId=${namespaceId}:${name}`);

				return { ...tokenInfo, supply };
			} catch (error) {
				if (error instanceof NotFoundError || error.statusCode === 404)
					return tokenInfo;

				throw error;
			}
		}));

		return Object.fromEntries(tokenInfos.map(tokenInfo => [tokenInfo.id, tokenInfo]));
	};

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

		const definitions = [];

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

				if (ids.includes(tokenIdFromRaw(definition.id)))
					definitions.push(definition);
			}
		});
		await Promise.all(fetchNamespaceDefinitions);

		return this.#resolveTokenInfos(networkProperties, definitions);
	};

	/**
	 * Fetches owned tokens for an account.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} address - The account address.
	 * @returns {Promise<Array<Token | RawToken>>} The account's tokens with resolved amounts and metadata.
	 */
	fetchAccountTokens = async (networkProperties, address) => {
		const { nodeUrl, networkCurrency } = networkProperties;
		const [mosaicsDTO, definitionsDTO] = await Promise.all([
			this.#makeRequest(`${nodeUrl}/account/mosaic/owned?address=${address}`),
			this.#makeRequest(`${nodeUrl}/account/mosaic/owned/definition?address=${address}`)
		]);
		const tokenInfos = await this.#resolveTokenInfos(networkProperties, definitionsDTO.data || []);

		// XEM has no definition, so comes from network properties.
		tokenInfos[networkCurrency.id] = networkCurrency;

		return tokenListFromDTO(mosaicsDTO.data || [], tokenInfos);
	};
}

