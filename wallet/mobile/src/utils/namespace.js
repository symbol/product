import { generateNamespaceId } from 'symbol-sdk/symbol';
import { utils } from 'symbol-sdk-v3';

const { hexToUint8, uint8ToHex } = utils;

export const namespaceIdFromName = (namespaceName) => {
    return generateNamespaceId(namespaceName).toString(16);
}

export const namespaceIdFromRaw = (rawNamespaceId) => {
    const relevantPart = rawNamespaceId.substr(2, 16);
    const encodedNamespaceId = uint8ToHex(hexToUint8(relevantPart).reverse());

    return encodedNamespaceId;
};
