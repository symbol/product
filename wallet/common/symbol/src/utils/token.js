import { addressFromRaw } from './account';
import { MosaicFlags } from '../constants';
import { Address, generateMosaicId } from 'symbol-sdk/symbol';
import { ApiError, absoluteToRelativeAmount } from 'wallet-common-core';
import * as Crypto from 'crypto';

/** @typedef {import('../types/Token').Token} Token */
/** @typedef {import('../types/Token').RawToken} RawToken */
/** @typedef {import('../types/Token').TokenInfo} TokenInfo */
/** @typedef {import('../types/Token').MosaicDTO} MosaicDTO */

/**
 * Generates a random nonce.
 * @returns {number} The nonce.
 */
export const generateNonce = () => {
	const bytes = Crypto.randomBytes(4);
	const nonce = new Uint8Array(bytes);

	return new Uint32Array(nonce.buffer)[0];
};

/**
 * Derives the mosaic id from the owner address and nonce, matching the value the network assigns to the
 * mosaic definition transaction. Used to reference a freshly created mosaic in the paired supply change.
 * @param {string} ownerAddress - The mosaic creator address.
 * @param {number} nonce - The mosaic nonce.
 * @returns {string} The mosaic id.
 */
export const mosaicIdFromNonce = (ownerAddress, nonce) => {
	const mosaicId = generateMosaicId(new Address(ownerAddress), nonce);

	return mosaicId.toString(16).toUpperCase().padStart(16, '0');
};

/**
 * Formats a mosaic node DTO into token info. Names are left empty and resolved separately.
 * @param {object} mosaic - The mosaic node from the API response.
 * @returns {TokenInfo} The token info.
 */
export const tokenInfoFromDTO = mosaic => {
	const duration = parseInt(mosaic.duration);
	const startHeight = parseInt(mosaic.startHeight);

	return {
		id: mosaic.id,
		divisibility: mosaic.divisibility,
		names: [],
		duration,
		startHeight,
		endHeight: startHeight + duration,
		isUnlimitedDuration: duration === 0,
		creator: addressFromRaw(mosaic.ownerAddress),
		supply: absoluteToRelativeAmount(parseInt(mosaic.supply), mosaic.divisibility),
		isSupplyMutable: isSupplyMutableFlag(mosaic.flags),
		isTransferable: isTransferableFlag(mosaic.flags),
		isRestrictable: isRestrictableFlag(mosaic.flags),
		isRevokable: isRevokableFlag(mosaic.flags)
	};
};

/**
 * Gets the token amount from a token list.
 * @param {Array.<Token | MosaicDTO>} tokenList - The list of tokens.
 * @param {string} tokenId - The token id.
 * @returns {string} The token amount or '0' if the token is not found.
 */
export const getTokenAmount = (tokenList, tokenId) => {
	if (!tokenList || !tokenId)
		throw new ApiError('Failed to get token amount. Missing required parameters.');

	const token = tokenList.find(listedToken => listedToken.id === tokenId);

	return token ? token.amount : '0';
};

/**
 * Tries to format a token list from DTO data. If the token info is not available, raw token data is returned instead.
 * @param {MosaicDTO[]} mosaics - The raw mosaic list.
 * @param {Object.<string, TokenInfo>} tokenInfos - The token id to token info map.
 * @returns {Array.<Token | RawToken>} The token list.
 */
export const tokenListFromDTO = (mosaics, tokenInfos) => {
	if (!mosaics || !tokenInfos)
		throw new ApiError('Failed to format tokens. Missing required parameters.');

	return mosaics.map(mosaic => {
		if (mosaic && tokenInfos[mosaic.id])
			return tokenFromDTO(mosaic, tokenInfos[mosaic.id]);

		return {
			amount: null,
			absoluteAmount: mosaic.amount,
			name: mosaic.id,
			id: mosaic.id
		};
	});
};

/**
 * Formats the token using the token info.
 * @param {MosaicDTO} mosaic - The raw mosaic data.
 * @param {TokenInfo} tokenInfo - The token info data.
 * @returns {Token} The formatted token data.
 */
export const tokenFromDTO = (mosaic, tokenInfo) => {
	if (!mosaic || !tokenInfo)
		throw new ApiError('Failed to format token DTO. Missing required parameters.');

	return {
		...tokenInfo,
		amount: absoluteToRelativeAmount(mosaic.amount, tokenInfo.divisibility),
		name: tokenInfo.names?.[0] || mosaic.id
	};
};

/**
 * Checks if a mosaic can be revoked.
 * @param {Token} token - The token.
 * @param {number} chainHeight - The chain height.
 * @param {string} currentAddress - The current account address.
 * @param {string} sourceAddress - The source address to revoke the mosaic from.
 * @returns {boolean} True if the mosaic can be revoked, false otherwise.
 */
export const isMosaicRevokable = (token, chainHeight, currentAddress, sourceAddress) => {
	const hasRevokableFlag = token.isRevokable;
	const isCreatorCurrentAccount = token.creator === currentAddress;
	const isSelfRevocation = sourceAddress === currentAddress;
	const isMosaicExpired = token.endHeight <= chainHeight;
	const isMosaicActive = !isMosaicExpired || token.isUnlimitedDuration;

	return hasRevokableFlag && isCreatorCurrentAccount && !isSelfRevocation && isMosaicActive;
};

/**
 * Checks if a mosaic total supply can be changed.
 * @param {Token} token - The token.
 * @param {number} chainHeight - The chain height.
 * @param {string} currentAddress - The current account address.
 * @returns {boolean} True if the mosaic supply can be changed, false otherwise.
 */
export const isMosaicSupplyModifiable = (token, chainHeight, currentAddress) => {
	const hasSupplyMutableFlag = token.isSupplyMutable;
	const isCreatorCurrentAccount = token.creator === currentAddress;
	const isMosaicExpired = token.endHeight <= chainHeight;
	const isMosaicActive = !isMosaicExpired || token.isUnlimitedDuration;

	return hasSupplyMutableFlag && isCreatorCurrentAccount && isMosaicActive;
};

/**
 * Checks if a mosaic flag is supply mutable.
 * @param {number} flags - The mosaic flags.
 * @returns {boolean} True if the flag is supply mutable, false otherwise.
 */
export const isSupplyMutableFlag = flags => (flags & MosaicFlags.SUPPLY_MUTABLE) !== 0;

/**
 * Checks if a mosaic flag is transferable.
 * @param {number} flags - The mosaic flags.
 * @returns {boolean} True if the flag is transferable, false otherwise.
 */
export const isTransferableFlag = flags => (flags & MosaicFlags.TRANSFERABLE) !== 0;

/**
 * Checks if a mosaic flag is restrictable.
 * @param {number} flags - The mosaic flags.
 * @returns {boolean} True if the flag is restrictable, false otherwise.
 */
export const isRestrictableFlag = flags => (flags & MosaicFlags.RESTRICTABLE) !== 0;

/**
 * Checks if a mosaic flag is revokable.
 * @param {number} flags - The mosaic flags.
 * @returns {boolean} True if the flag is revokable, false otherwise.
 */
export const isRevokableFlag = flags => (flags & MosaicFlags.REVOKABLE) !== 0;
