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
export const namespaceFromDTO = (namespaceDTO, namespaceNames) => {
    const { namespace } = namespaceDTO;
    const creator = addressFromRaw(namespace.ownerAddress);
    const aliasAddress = namespace.alias.address ? addressFromRaw(namespace.alias.address) : null;
    const aliasType = namespace.alias.type === 1 ? 'mosaic' : namespace.alias.type === 2 ? 'address' : 'none';

    return {
        id: namespace.level2 || namespace.level1 || namespace.level0,
        name:
            namespaceNames[namespace.level0] +
            (namespace.level1 ? `.${namespaceNames[namespace.level1]}` : '') +
            (namespace.level2 ? `.${namespaceNames[namespace.level2]}` : ''),
        aliasType,
        linkedMosaicId: aliasType === 'mosaic' ? namespace.alias.mosaicId : null,
        linkedAddress: aliasType === 'address' ? aliasAddress : null,
        startHeight: parseInt(namespace.startHeight),
        endHeight: parseInt(namespace.endHeight),
        creator,
    };
};
