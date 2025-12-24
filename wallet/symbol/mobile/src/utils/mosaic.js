import * as MosaicTypes from '@/app/types/Mosaic';

/**
 * Filters out the native mosaic from a mosaic list.
 * @param {MosaicTypes.Mosaic[]} mosaicList - The mosaic list.
 * @param {string} nativeMosaicId - The native mosaic id.
 * @returns {MosaicTypes.Mosaic[]} The filtered mosaic list, excluding the native mosaic.
 */
export const filterCustomMosaics = (mosaicList, nativeMosaicId) => {
	return mosaicList.filter(mosaic => mosaic.id !== nativeMosaicId);
};
