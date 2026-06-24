import { MosaicPropertyName } from '../constants';
import { ApiError, absoluteToRelativeAmount } from 'wallet-common-core';

/** @typedef {import('../types/Mosaic').Mosaic} Mosaic */
/** @typedef {import('../types/Mosaic').MosaicInfo} MosaicInfo */

/**
 * Converts a raw NEM mosaic id object to a string id.
 * @param {{ namespaceId: string, name: string } | string} rawMosaicId - The raw mosaic id object, or an already-formatted id string.
 * @returns {string} The mosaic id string (e.g. 'nem.xem').
 */
export const mosaicIdFromRaw = rawMosaicId => {
	if (typeof rawMosaicId === 'string')
		return rawMosaicId;

	return `${rawMosaicId.namespaceId}.${rawMosaicId.name}`;
};

/**
 * Converts a mosaic id string to a raw NEM mosaic id object.
 * @param {string} mosaicId - The mosaic id string (e.g. 'nem.xem' or 'root.sub.name').
 * @returns {{ namespaceId: string, name: string }} The raw mosaic id object.
 */
export const mosaicIdToRaw = mosaicId => {
	const separatorIndex = mosaicId.lastIndexOf('.');

	if (separatorIndex === -1)
		throw new ApiError(`Failed to parse mosaic id. Invalid mosaic id: ${mosaicId}.`);

	return {
		namespaceId: mosaicId.slice(0, separatorIndex),
		name: mosaicId.slice(separatorIndex + 1)
	};
};

/**
 * Gets the relative amount of a specific mosaic from a mosaic list.
 * @param {Mosaic[]} mosaicList - The list of mosaics.
 * @param {string} mosaicId - The mosaic id.
 * @returns {string} The relative amount, or '0' when the mosaic is absent from the list.
 */
export const getMosaicAmount = (mosaicList, mosaicId) => {
	if (!mosaicList || !mosaicId)
		throw new ApiError('Failed to get mosaic amount. Missing required parameters.');

	const nativeMosaic = mosaicList.find(mosaic => mosaic.id === mosaicId);

	return nativeMosaic ? nativeMosaic.amount : '0';
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
 * Builds a MosaicInfo object from a NEM mosaic definition DTO.
 * The DTO comes from /mosaic/definition/page or /account/mosaic/owned/definition.
 * @param {{ id: { namespaceId: string, name: string }, properties: Array }} mosaicDefinitionDTO - The mosaic definition DTO.
 * @returns {MosaicInfo} The mosaic info object.
 */
export const mosaicInfoFromDTO = mosaicDefinitionDTO => {
	const id = mosaicIdFromRaw(mosaicDefinitionDTO.id);

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
 * Converts a list of raw mosaic DTOs to normalized Mosaic objects using a mosaicInfos map.
 * @param {Array} mosaicsDTO - The raw mosaic DTOs (each with `mosaicId`/`id` and `quantity`/`amount`).
 * @param {Record<string, MosaicInfo>} mosaicInfos - The map of MosaicInfo keyed by mosaic id string (from fetchMosaicInfos).
 * @returns {Mosaic[]} The normalized mosaic list.
 */
export const mosaicListFromDTO = (mosaicsDTO, mosaicInfos) => {
	if (!mosaicsDTO)
		return [];

	return mosaicsDTO.map(mosaicDTO => {
		const mosaicId = mosaicIdFromRaw(mosaicDTO.mosaicId || mosaicDTO.id);
		const mosaicInfo = mosaicInfos?.[mosaicId];
		const rawAmount = mosaicDTO.quantity ?? mosaicDTO.amount;

		// Without resolved mosaic info the relative amount and metadata are unavailable.
		if (!mosaicInfo) {
			return {
				id: mosaicId,
				name: mosaicId,
				amount: null,
				absoluteAmount: rawAmount,
				divisibility: null
			};
		}

		// Spread the full MosaicInfo so the Mosaic carries every resolved field (supply, flags, …),
		// then layer on the relative amount and the resolved display name.
		return {
			...mosaicInfo,
			amount: absoluteToRelativeAmount(rawAmount, mosaicInfo.divisibility),
			name: mosaicInfo.name || mosaicId
		};
	});
};
