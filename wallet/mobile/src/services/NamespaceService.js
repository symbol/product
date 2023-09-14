import { addressFromRaw, makeRequest, namespaceIdFromRaw } from 'src/utils';
import _ from 'lodash';
import { NamespaceId } from 'symbol-sdk';

export class NamespaceService {
    static async fetchAccountNamespaces(address, networkProperties) {
        const endpoint = `${networkProperties.nodeUrl}/namespaces?ownerAddress=${address}&pageSize=100`;
        const { data } = await makeRequest(endpoint);
        const namespaces = data.map((el) => el.namespace);
        const namespaceIds = namespaces
            .map((namespace) => [namespace.level0, namespace.level1, namespace.level2])
            .flat()
            .filter((namespaceId) => !!namespaceId);
        const namespaceNames = await NamespaceService.fetchNamespaceNames(networkProperties, namespaceIds);

        return namespaces.map((namespace) => {
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
        });
    }

    static async fetchMosaicNames(networkProperties, mosaicIds) {
        const endpoint = `${networkProperties.nodeUrl}/namespaces/mosaic/names`;
        const payload = {
            mosaicIds,
        };
        const { mosaicNames } = await makeRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        return _.chain(mosaicNames).keyBy('mosaicId').mapValues('names').value();
    }

    static async fetchNamespaceNames(networkProperties, namespaceIds) {
        const endpoint = `${networkProperties.nodeUrl}/namespaces/names`;
        const payload = {
            namespaceIds,
        };
        const namespaceNames = await makeRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        return _.chain(namespaceNames).keyBy('id').mapValues('name').value();
    }

    static async fetchNamespaceInfos(networkProperties, namespaceIds) {
        const namespaceInfos = await Promise.all(
            namespaceIds.map(async (namespaceId) => {
                try {
                    return {
                        namespaceId,
                        value: await NamespaceService.fetchNamespaceInfo(networkProperties, namespaceId),
                    };
                } catch {
                    return;
                }
            })
        );

        return _.chain(_.compact(namespaceInfos)).keyBy('namespaceId').mapValues('value').value();
    }

    static async fetchNamespaceInfo(networkProperties, namespaceId) {
        const endpoint = `${networkProperties.nodeUrl}/namespaces/${namespaceId}`;
        const { namespace } = await makeRequest(endpoint);

        return namespace;
    }

    static async resolveAddresses(networkProperties, namespaceIdsWithHeight) {
        const namespaceInfos = await Promise.all(
            namespaceIdsWithHeight.map(async (namespaceIdWithHeight) => {
                try {
                    return {
                        namespaceId: namespaceIdWithHeight.namespaceId,
                        value: await NamespaceService.resolveAddress(networkProperties, namespaceIdWithHeight),
                    };
                } catch (error) {
                    return;
                }
            })
        );

        return _.chain(_.compact(namespaceInfos)).keyBy('namespaceId').mapValues('value').value();
    }

    static async resolveAddress(networkProperties, namespaceIdWithHeight) {
        const { namespaceId, height } = namespaceIdWithHeight;
        const endpoint = `${networkProperties.nodeUrl}/statements/resolutions/address?height=${height}&pageSize=100`;
        const { data } = await makeRequest(endpoint);
        const statement = data.find((statement) => namespaceIdFromRaw(statement.statement.unresolved) === namespaceId);
        const { resolved } = statement.statement.resolutionEntries[0];

        return addressFromRaw(resolved);
    }

    static async namespaceIdToAddress(networkProperties, namespaceId) {
        const namespace = await NamespaceService.fetchNamespaceInfo(networkProperties, namespaceId);

        if (!namespace.alias.address) {
            throw Error('error_unknown_account_name');
        }

        return addressFromRaw(namespace.alias.address);
    }

    static async namespaceNameToAddress(networkProperties, namespaceName) {
        const namespaceId = new NamespaceId(namespaceName).toHex();

        try {
            const address = await NamespaceService.namespaceIdToAddress(networkProperties, namespaceId);

            return address;
        } catch (e) {
            if (e.message === 'error_fetch_not_found') {
                throw Error('error_unknown_account_name');
            }

            throw Error(e.message);
        }
    }
}
