import { MosaicFlags } from '../constants';
import { ApiError, absoluteToRelativeAmount } from 'wallet-common-core';
import * as Crypto from 'crypto';

/** @typedef {import('../types/Mosaic').Mosaic} Mosaic */
/** @typedef {import('../types/Mosaic').RawMosaic} RawMosaic */
/** @typedef {import('../types/Mosaic').MosaicInfo} MosaicInfo */
/** @typedef {import('../types/Account').MosaicDTO} MosaicDTO */

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
 * Gets the mosaic amount from a mosaic list.
 * @param {Mosaic[]} mosaicList - The list of mosaics.
 * @param {string} mosaicId - The mosaic id.
 * @returns {string} The mosaic amount or '0' if the mosaic is not found.
 */
export const getMosaicAmount = (mosaicList, mosaicId) => {
	if (!mosaicList || !mosaicId) 
		throw new ApiError('Failed to get mosaic amount. Missing required parameters.');
    
	const nativeMosaic = mosaicList.find(mosaic => mosaic.id === mosaicId);

	return nativeMosaic ? nativeMosaic.amount : '0';
};

/**
 * Tries to format a mosaic list from DTO data. If the mosaic info is not available, raw mosaic data is returned instead.
 * @param {MosaicDTO[]} mosaics - The raw mosaic list.
 * @param {MosaicInfo[]} mosaicInfos - The mosaic info list.
 * @returns {Array.<Mosaic | RawMosaic>} The mosaic list.
 */
export const formatMosaicList = (mosaics, mosaicInfos) => {
	if (!mosaics || !mosaicInfos) 
		throw new ApiError('Failed to format mosaics. Missing required parameters.');
    
	return mosaics.map(mosaic => {
		if (mosaic && mosaicInfos[mosaic.id]) 
			return mosaicFromDTO(mosaic, mosaicInfos[mosaic.id]);

		return {
			amount: null,
			absoluteAmount: mosaic.amount,
			name: mosaic.id,
			id: mosaic.id
		};
	});
};

/**
 * Formats the mosaic using the mosaic info.
 * @param {RawMosaic} mosaic - The raw mosaic data.
 * @param {MosaicInfo} mosaicInfo - The mosaic info data.
 * @returns {Mosaic} The formatted mosaic data.
 */
export const mosaicFromDTO = (mosaic, mosaicInfo) => {
	if (!mosaic || !mosaicInfo) 
		throw new ApiError('Failed to format mosaic DTO. Missing required parameters.');

	return {
		...mosaicInfo,
		amount: absoluteToRelativeAmount(mosaic.amount, mosaicInfo.divisibility),
		name: mosaicInfo.names?.[0] || mosaic.id
	};
};

/**
 * Checks if a mosaic can be revoked.
 * @param {Mosaic} mosaic - The mosaic.
 * @param {number} chainHeight - The chain height.
 * @param {string} currentAddress - The current account address.
 * @param {string} sourceAddress - The source address to revoke the mosaic from.
 * @returns {boolean} True if the mosaic can be revoked, false otherwise.
 */
export const isMosaicRevokable = (mosaic, chainHeight, currentAddress, sourceAddress) => {
	const hasRevokableFlag = mosaic.isRevokable;
	const isCreatorCurrentAccount = mosaic.creator === currentAddress;
	const isSelfRevocation = sourceAddress === currentAddress;
	const isMosaicExpired = mosaic.endHeight - chainHeight <= 0;
	const isMosaicActive = !isMosaicExpired || mosaic.isUnlimitedDuration;

	return hasRevokableFlag && isCreatorCurrentAccount && !isSelfRevocation && isMosaicActive;
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
