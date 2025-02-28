import { MosaicFlags } from '@/app/constants';
import * as MosaicTypes from '@/app/types/Mosaic';
import * as Crypto from 'crypto';

/**
 * Gets the mosaic amount from a mosaic list.
 * @param {MosaicTypes.Mosaic[]} mosaicList - The list of mosaics.
 * @param {string} nativeMosaicId - The mosaic id.
 * @returns {number|null} The mosaic amount or null if the mosaic is not found.
 */
export const getMosaicAmount = (mosaicList, nativeMosaicId) => {
    if (!mosaicList || !nativeMosaicId) {
        throw new Error('Failed to get mosaic amount. Missing required parameters.');
    }
    const nativeMosaic = mosaicList.find((mosaic) => mosaic.id === nativeMosaicId);

    return nativeMosaic ? nativeMosaic.amount : null;
};

/**
 * Gets the mosaic relative amount.
 * @param {number} absoluteAmount - The mosaic absolute amount.
 * @param {number} divisibility - The mosaic divisibility.
 * @returns {number} The mosaic relative amount.
 */
export const absoluteToRelativeAmount = (absoluteAmount, divisibility) => {
    return absoluteAmount / Math.pow(10, divisibility);
};

/**
 * Gets the mosaic absolute amount.
 * @param {number} relativeAmount - The mosaic relative amount.
 * @param {number} divisibility - The mosaic divisibility.
 * @returns {number} The mosaic absolute amount.
 */
export const relativeToAbsoluteAmount = (relativeAmount, divisibility) => {
    return relativeAmount * Math.pow(10, divisibility);
};

/**
 * Tries to format a mosaic list from raw data. If the mosaic info is not available, raw mosaic data is returned (except for the amount).
 * @param {MosaicTypes.RawMosaic[]} mosaics - The raw mosaic list.
 * @param {MosaicTypes.MosaicInfo[]} mosaicInfos - The mosaic info list.
 * @returns {Array.<MosaicTypes.Mosaic | MosaicTypes.RawMosaic>} The mosaic list.
 */
export const mosaicListFromRaw = (mosaics, mosaicInfos) => {
    if (!mosaics || !mosaicInfos) {
        throw new Error('Failed to format mosaics. Missing required parameters.');
    }

    return mosaics.map((mosaic) => {
        if (mosaic && mosaicInfos[mosaic.id]) {
            return mosaicFromRaw(mosaic, mosaicInfos[mosaic.id]);
        }

        return {
            amount: null,
            name: mosaic.id,
            id: mosaic.id,
        };
    });
};

/**
 * Formats the mosaic using the mosaic info.
 * @param {MosaicTypes.RawMosaic} mosaic - The raw mosaic data.
 * @param {MosaicTypes.MosaicInfo} mosaicInfo - The mosaic info data.
 * @returns {MosaicTypes.Mosaic} The formatted mosaic data.
 */
export const mosaicFromRaw = (mosaic, mosaicInfo) => {
    if (!mosaic || !mosaicInfo) {
        throw new Error('Failed to format mosaic. Missing required parameters.');
    }

    return {
        ...mosaicInfo,
        amount: mosaic.amount / Math.pow(10, mosaicInfo.divisibility),
        name: mosaicInfo.names?.[0] || mosaic.id,
        divisibility: mosaicInfo.divisibility,
        id: mosaic.id,
    };
};

/**
 * Filters out the native mosaic from a mosaic list.
 * @param {MosaicTypes.Mosaic[]} mosaicList - The mosaic list.
 * @param {string} nativeMosaicId - The native mosaic id.
 * @returns {MosaicTypes.Mosaic[]} The filtered mosaic list, excluding the native mosaic.
 */
export const filterCustomMosaics = (mosaicList, nativeMosaicId) => {
    return mosaicList.filter((mosaic) => mosaic.id !== nativeMosaicId);
};

/**
 * Checks if a mosaic can be revoked.
 * @param {MosaicTypes.Mosaic} mosaic - The mosaic.
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
 * Generates a random nonce.
 * @returns {number} The nonce.
 */
export const generateNonce = () => {
    const bytes = Crypto.randomBytes(4);
    const nonce = new Uint8Array(bytes);

    return new Uint32Array(nonce.buffer)[0];
};

// export const generateMosaicId = (nonce, ownerAddress) => {
//     return MosaicId.createFromNonce(MosaicNonce.createFromHex(nonce), Address.createFromRawAddress(ownerAddress)).toHex();
// };

/**
 * Checks if a mosaic flag is supply mutable.
 * @param {number} flags - The mosaic flags.
 * @returns {boolean} True if the flag is supply mutable, false otherwise.
 */
export const isSupplyMutableFlag = (flags) => (flags & MosaicFlags.SUPPLY_MUTABLE) !== 0;

/**
 * Checks if a mosaic flag is transferable.
 * @param {number} flags - The mosaic flags.
 * @returns {boolean} True if the flag is transferable, false otherwise.
 */
export const isTransferableFlag = (flags) => (flags & MosaicFlags.TRANSFERABLE) !== 0;

/**
 * Checks if a mosaic flag is restrictable.
 * @param {number} flags - The mosaic flags.
 * @returns {boolean} True if the flag is restrictable, false otherwise.
 */
export const isRestrictableFlag = (flags) => (flags & MosaicFlags.RESTRICTABLE) !== 0;

/**
 * Checks if a mosaic flag is revokable.
 * @param {number} flags - The mosaic flags.
 * @returns {boolean} True if the flag is revokable, false otherwise.
 */
export const isRevokableFlag = (flags) => (flags & MosaicFlags.REVOKABLE) !== 0;
