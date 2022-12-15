import { makeRequest } from 'src/utils';
import _ from 'lodash';
import { Convert, RawAddress } from 'symbol-sdk';

export class NamespaceService {
    static async fetchMosaicNames(networkProperties, mosaicIds) {
        const endpoint = `${networkProperties.nodeUrl}/namespaces/mosaic/names`;
        const payload = {
            mosaicIds
        };
        const { mosaicNames } = await makeRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json'
            },
        });
        
        return _.chain(mosaicNames)
            .keyBy('mosaicId')
            .mapValues('names')
            .value();
    }

    static async fetchNamespaceNames(networkProperties, namespaceIds) {
        const endpoint = `${networkProperties.nodeUrl}/namespaces/names`;
        const payload = {
            namespaceIds
        };
        const namespaceNames = await makeRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json'
            },
        });
        
        return _.chain(namespaceNames)
            .keyBy('id')
            .mapValues('name')
            .value();
    }

    static async fetchNamespaceInfos(networkProperties, namespaceIds) {
        const namespaceInfos = await Promise.all(namespaceIds.map(async namespaceId => ({
            namespaceId, 
            value: await NamespaceService.fetchNamespaceInfo(networkProperties, namespaceId)
        })));

        return _.chain(namespaceInfos)
            .keyBy('namespaceId')
            .mapValues('value')
            .value();
    }

    static async fetchNamespaceInfo(networkProperties, namespaceId) {
        const endpoint = `${networkProperties.nodeUrl}/namespaces/${namespaceId}`;
        const { namespace } = await makeRequest(endpoint);
        
        return namespace;
    }

    static async resolveAddresses(networkProperties, namespaceIds) {
        const namespaceInfos = await Promise.all(namespaceIds.map(async namespaceId => ({
            namespaceId, 
            value: await NamespaceService.resolveAddress(networkProperties, namespaceId)
        })));

        return _.chain(namespaceInfos)
            .keyBy('namespaceId')
            .mapValues('value')
            .value();
    }

    static async resolveAddress(networkProperties, namespaceId) {
        const namespace = await NamespaceService.fetchNamespaceInfo(networkProperties, namespaceId);
        const { address } = namespace.alias;
        const plainAddress = RawAddress.addressToString(Convert.hexToUint8(address));
        
        return plainAddress;
    }
}
