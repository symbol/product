import { addressFromRaw, makeRequest } from 'src/utils';
import _ from 'lodash';

export class NamespaceService {
    static async fetchAccountNamespaces(address, networkProperties) {
        const endpoint = `${networkProperties.nodeUrl}/namespaces?ownerAddress=${address}&pageSize=100`;
        const { data } = await makeRequest(endpoint);
        const namespaces = data.map(el => el.namespace);
        const namespaceIds = namespaces.map(namespace => [namespace.level0, namespace.level1, namespace.level2]).flat().filter(namespaceId => !!namespaceId);
        const namespaceNames = await NamespaceService.fetchNamespaceNames(networkProperties, namespaceIds);

        return namespaces.map(namespace => {
            const ownerAddress = addressFromRaw(namespace.ownerAddress);
            const aliasAddress = namespace.alias.address ? addressFromRaw(namespace.alias.address) : null;

            return {
                id: namespace.level2 || namespace.level1 || namespace.level0,
                name: namespaceNames[namespace.level0] + (namespace.level1 ? `.${namespaceNames[namespace.level1]}` : '') + (namespace.level2 ? `.${namespaceNames[namespace.level2]}` : ''),
                alias: {
                    type: namespace.alias.type === 1 ? 'mosaic' : 'address',
                    id: namespace.alias.mosaicId || aliasAddress || ''
                },
                startHeight: parseInt(namespace.startHeight),
                endHeight: parseInt(namespace.endHeight),
                ownerAddress
            }
        });
    }
    
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
        const namespaceInfos = await Promise.all(namespaceIds.map(async namespaceId => {
            try {
                return {
                    namespaceId, 
                    value: await NamespaceService.fetchNamespaceInfo(networkProperties, namespaceId)
                }
            }
            catch {
                return;
            }
        }));

        return _.chain(_.compact(namespaceInfos))
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
        const namespaceInfos = await Promise.all(namespaceIds.map(async namespaceId => {
            try {
                return {
                    namespaceId, 
                    value: await NamespaceService.resolveAddress(networkProperties, namespaceId)
                }
            }
            catch {
                return;
            }
        }));

        return _.chain(_.compact(namespaceInfos))
            .keyBy('namespaceId')
            .mapValues('value')
            .value();
    }

    static async resolveAddress(networkProperties, namespaceId) {
        const namespace = await NamespaceService.fetchNamespaceInfo(networkProperties, namespaceId);
        const { address } = namespace.alias;
        const plainAddress = addressFromRaw(address);
        
        return plainAddress;
    }
}
