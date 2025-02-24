import { generateNamespaceId } from 'symbol-sdk/symbol';
import { utils } from 'symbol-sdk';
import * as NamespaceTypes from '@/app/types/Namespace';
import { addressFromRaw } from '@/app/utils/account';

const { hexToUint8, uint8ToHex } = utils;

/**
 * Generates the namespace id from a given namespace name.
 * @param {string} namespaceName - The namespace name.
 * @returns {string} The namespace id
 */
export const namespaceIdFromName = (namespaceName) => {
    return generateNamespaceId(namespaceName).toString(16);
};

/**
 * Decode raw namespace id.
 * @param {string} rawNamespaceId - The raw namespace id.
 * @returns {string} The namespace id
 */
export const namespaceIdFromRaw = (rawNamespaceId) => {
    const relevantPart = rawNamespaceId.substr(2, 16);
    const encodedNamespaceId = uint8ToHex(hexToUint8(relevantPart).reverse());

    return encodedNamespaceId;
};

/**
 * Formats the namespace DTO to a namespace object.
 * @param {NamespaceTypes.NamespaceDTO} namespaceDTO - The namespace DTO.
 * @param {Object.<string, string>} namespaceNames - The namespace names map.
 * @returns {NamespaceTypes.Namespace} The namespace object.
 */
export const namespaceFromRaw = (namespaceDTO, namespaceNames) => {
    const creator = addressFromRaw(namespaceDTO.ownerAddress);
    const aliasAddress = namespaceDTO.alias.address ? addressFromRaw(namespaceDTO.alias.address) : null;
    const aliasType = namespaceDTO.alias.type === 1 ? 'mosaic' : namespaceDTO.alias.type === 2 ? 'address' : 'none';

    return {
        id: namespaceDTO.level2 || namespaceDTO.level1 || namespaceDTO.level0,
        name:
            namespaceNames[namespaceDTO.level0] +
            (namespaceDTO.level1 ? `.${namespaceNames[namespaceDTO.level1]}` : '') +
            (namespaceDTO.level2 ? `.${namespaceNames[namespaceDTO.level2]}` : ''),
        aliasType,
        linkedMosaicId: aliasType === 'mosaic' ? namespaceDTO.alias.mosaicId : null,
        linkedAddress: aliasType === 'address' ? aliasAddress : null,
        startHeight: parseInt(namespaceDTO.startHeight),
        endHeight: parseInt(namespaceDTO.endHeight),
        creator,
    };
};
