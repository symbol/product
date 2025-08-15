import { addressFromRaw } from './account';
import { AliasTypeMessage } from '../constants';
import { utils } from 'symbol-sdk';
import { generateNamespaceId } from 'symbol-sdk/symbol';

const { hexToUint8, uint8ToHex } = utils;

/** @typedef {import('../types/Namespace').Namespace} Namespace */
/** @typedef {import('../types/Namespace').NamespaceDTO} NamespaceDTO */

/**
 * Generates the namespace id from a given namespace name.
 * @param {string} namespaceName - The namespace name.
 * @returns {string} The namespace id
 */
export const namespaceIdFromName = namespaceName => {
	const namespaceLevels = namespaceName.split('.');

	return namespaceLevels
		.reduce((parentNamespaceId, namespaceLevelName) => generateNamespaceId(namespaceLevelName, parentNamespaceId), 0n)
		.toString(16)
		.toUpperCase();
};

/**
 * Decode raw namespace id.
 * @param {string} rawNamespaceId - The raw namespace id.
 * @returns {string} The namespace id
 */
export const namespaceIdFromRaw = rawNamespaceId => {
	const relevantPart = rawNamespaceId.substr(2, 16);
	const encodedNamespaceId = uint8ToHex(hexToUint8(relevantPart).reverse());

	return encodedNamespaceId;
};

/**
 * Formats the namespace DTO to a namespace object.
 * @param {NamespaceDTO} namespaceDTO - The namespace DTO.
 * @param {object.<string, string>} namespaceNames - The namespace names map.
 * @returns {Namespace} The namespace object.
 */
export const namespaceFromDTO = (namespaceDTO, namespaceNames) => {
	const { namespace } = namespaceDTO;

	return {
		id: namespace.level2 || namespace.level1 || namespace.level0,
		name:
            namespaceNames[namespace.level0] +
            (namespace.level1 ? `.${namespaceNames[namespace.level1]}` : '') +
            (namespace.level2 ? `.${namespaceNames[namespace.level2]}` : ''),
		aliasType: AliasTypeMessage[namespace.alias.type],
		linkedMosaicId: namespace.alias.mosaicId 
			? namespace.alias.mosaicId 
			: null,
		linkedAddress: namespace.alias.address
			? addressFromRaw(namespace.alias.address) 
			: null,
		startHeight: parseInt(namespace.startHeight),
		endHeight: parseInt(namespace.endHeight),
		creator: addressFromRaw(namespace.ownerAddress)
	};
};
