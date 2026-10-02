import { MosaicPropertyName } from '../constants';
import { ApiError, absoluteToRelativeAmount } from 'wallet-common-core';

/** @typedef {import('../types/Token').Token} Token */
/** @typedef {import('../types/Token').TokenInfo} TokenInfo */
/** @typedef {import('../types/Token').RawToken} RawToken */

/**
 * Converts a raw NEM mosaic id object to a token id string.
 * @param {{ namespaceId: string, name: string } | string} rawMosaicId - The raw mosaic id object, or an already-formatted id string.
 * @returns {string} The token id string (e.g. 'nem.xem').
 */
export const tokenIdFromRaw = rawMosaicId => {
	if (typeof rawMosaicId === 'string')
		return rawMosaicId;

	return `${rawMosaicId.namespaceId}.${rawMosaicId.name}`;
};

/**
 * Converts a token id string to a raw NEM mosaic id object.
 * @param {string} tokenId - The token id string (e.g. 'nem.xem' or 'root.sub.name').
 * @returns {{ namespaceId: string, name: string }} The raw mosaic id object.
 */
export const tokenIdToRaw = tokenId => {
	const separatorIndex = tokenId.lastIndexOf('.');

	if (separatorIndex === -1)
		throw new ApiError(`Failed to parse token id. Invalid token id: ${tokenId}.`);

	return {
		namespaceId: tokenId.slice(0, separatorIndex),
		name: tokenId.slice(separatorIndex + 1)
	};
};

/**
 * Gets the relative amount of a specific token from a token list.
 * @param {Token[]} tokenList - The list of tokens.
 * @param {string} tokenId - The token id.
 * @returns {string} The relative amount, or '0' when the token is absent from the list.
 */
export const getTokenAmount = (tokenList, tokenId) => {
	if (!tokenList || !tokenId)
		throw new ApiError('Failed to get token amount. Missing required parameters.');

	const token = tokenList.find(listedToken => listedToken.id === tokenId);

	return token ? token.amount : '0';
};

/**
 * Reads a named property value from a NEM mosaic definition properties array.
 * @param {Array} properties - The mosaic definition properties array.
 * @param {string} propertyName - The name of the property to read.
 * @param {string} [defaultValue] - The value returned when the property is absent.
 * @returns {string} The property value, or the default value.
 */
export const getMosaicProperty = (properties, propertyName, defaultValue = '0') =>
	properties?.find(property => property.name === propertyName)?.value ?? defaultValue;

/**
 * Builds a TokenInfo object from a NEM mosaic definition DTO.
 * The DTO comes from /mosaic/definition/page or /account/mosaic/owned/definition.
 * @param {{ id: { namespaceId: string, name: string }, properties: Array }} mosaicDefinitionDTO - The mosaic definition DTO.
 * @returns {TokenInfo} The token info object.
 */
export const tokenInfoFromDTO = mosaicDefinitionDTO => {
	const id = tokenIdFromRaw(mosaicDefinitionDTO.id);

	return {
		id,
		name: id,
		divisibility: parseInt(getMosaicProperty(mosaicDefinitionDTO.properties, MosaicPropertyName.DIVISIBILITY)),
		supply: parseInt(getMosaicProperty(mosaicDefinitionDTO.properties, MosaicPropertyName.INITIAL_SUPPLY)),
		isSupplyMutable: getMosaicProperty(mosaicDefinitionDTO.properties, MosaicPropertyName.SUPPLY_MUTABLE) === 'true',
		isTransferable: getMosaicProperty(mosaicDefinitionDTO.properties, MosaicPropertyName.TRANSFERABLE) !== 'false'
	};
};

/**
 * Converts a list of raw mosaic DTOs to normalized Token objects using a tokenInfos map.
 * @param {Array} mosaicsDTO - The raw mosaic DTOs (each with `mosaicId`/`id` and `quantity`/`amount`).
 * @param {Record<string, TokenInfo>} tokenInfos - The map of TokenInfo keyed by token id string (from fetchTokenInfos).
 * @returns {Array.<Token | RawToken>} The normalized token list.
 */
export const tokenListFromDTO = (mosaicsDTO, tokenInfos) => {
	if (!mosaicsDTO || !tokenInfos)
		throw new ApiError('Failed to format tokens. Missing required parameters.');

	return mosaicsDTO.map(mosaicDTO => {
		const tokenId = tokenIdFromRaw(mosaicDTO.mosaicId || mosaicDTO.id);
		const tokenInfo = tokenInfos[tokenId];
		const rawAmount = mosaicDTO.quantity ?? mosaicDTO.amount;

		// Without resolved token info the relative amount and metadata are unavailable.
		if (!tokenInfo) {
			return {
				id: tokenId,
				name: tokenId,
				amount: null,
				absoluteAmount: rawAmount,
				divisibility: null
			};
		}

		// Spread the full TokenInfo so the Token carries every resolved field (supply, flags, …),
		// then layer on the relative amount and the resolved display name.
		return {
			...tokenInfo,
			amount: absoluteToRelativeAmount(rawAmount, tokenInfo.divisibility),
			name: tokenInfo.name || tokenId
		};
	});
};
