import { addressFromRaw } from '@/app/utils/account';
import { namespaceFromRaw, namespaceIdFromRaw } from '@/app/utils/namespace';
import { makeRequest } from '@/app/utils/network';
import _ from 'lodash';
import * as NamespaceTypes from '@/app/types/Namespace';
import * as NetworkTypes from '@/app/types/Network';

export class NamespaceService {
    /**
     * Fetches namespace list that is registered by a given account from the node.
     * @param {string} address - Requested account address.
     * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
     * @returns {Promise<NamespaceTypes.Namespace[]>} - The account namespaces.
     */
    static async fetchAccountNamespaces(address, networkProperties) {
        const endpoint = `${networkProperties.nodeUrl}/namespaces?ownerAddress=${address}&pageSize=100`;
        const { data } = await makeRequest(endpoint);
        const namespaces = data.map((el) => el.namespace);
        const namespaceIds = namespaces
            .map((namespace) => [namespace.level0, namespace.level1, namespace.level2])
            .flat()
            .filter((namespaceId) => !!namespaceId);
        const namespaceNames = await NamespaceService.fetchNamespaceNames(networkProperties, namespaceIds);

        return namespaces.map((namespaceDTO) => namespaceFromRaw(namespaceDTO, namespaceNames));
    }

    /**
     * Fetches mosaic names for a given list of mosaic ids from the node.
     * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
     * @param {string[]} mosaicIds - Requested mosaic ids.
     * @returns {Promise<{ [key: string]: string }>} - The mosaic names map.
     */
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

    /**
     * Fetches namespace names for a given list of namespace ids from the node.
     * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
     * @param {string[]} namespaceIds - Requested namespace ids.
     * @returns {Promise<{ [key: string]: string }>} - The namespace names map.
     */
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

    /**
     * Fetches the namespaces by list of ids.
     * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
     * @param {string[]} namespaceIds - Requested namespace ids.
     * @returns {Promise<{ [key: string]: NamespaceTypes.Namespace }>} - The namespaces map.
     */
    static async fetchNamespaceInfos(networkProperties, namespaceIds) {
        const namespaceNames = await NamespaceService.fetchNamespaceNames(networkProperties, namespaceIds);

        const namespaces = await Promise.all(
            namespaceIds.map(async (namespaceId) => {
                try {
                    const endpoint = `${networkProperties.nodeUrl}/namespaces/${namespaceId}`;
                    const { namespace } = await makeRequest(endpoint);

                    return {
                        namespaceId,
                        value: namespaceFromRaw(namespace, namespaceNames),
                    };
                } catch {
                    return;
                }
            })
        );

        return _.chain(_.compact(namespaces)).keyBy('namespaceId').mapValues('value').value();
    }

    /**
     * Fetches the namespace by id.
     * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
     * @param {string} namespaceId - Requested namespace id.
     * @returns {Promise<NamespaceTypes.Namespace>} - The namespace object.
     */
    static async fetchNamespaceInfo(networkProperties, namespaceId) {
        const endpoint = `${networkProperties.nodeUrl}/namespaces/${namespaceId}`;
        const { namespace } = await makeRequest(endpoint);
        const namespaceNames = await NamespaceService.fetchNamespaceNames(networkProperties, [namespaceId]);

        return namespaceFromRaw(namespace, namespaceNames);
    }

    /**
     * Fetches the address linked to a namespace id at a given height for a given list.
     * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
     * @param {{ namespaceId: string, height: number }[]} namespaceIdsWithHeight - Requested namespace ids with height.
     * @returns {Promise<{ [key: string]: string }>} - The resolved addresses map.
     */
    static async resolveAddressesAtHeight(networkProperties, namespaceIdsWithHeight) {
        const namespaceInfos = await Promise.all(
            namespaceIdsWithHeight.map(async (namespaceIdWithHeight) => {
                try {
                    return {
                        namespaceId: namespaceIdWithHeight.namespaceId,
                        value: await NamespaceService.resolveAddressAtHeight(networkProperties, namespaceIdWithHeight),
                    };
                } catch (error) {
                    return;
                }
            })
        );

        return _.chain(_.compact(namespaceInfos)).keyBy('namespaceId').mapValues('value').value();
    }

    /**
     * Fetches the address linked to a namespace id at a given height.
     * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
     * @param {string} namespaceId - Requested namespace id.
     * @param {number} height - Requested height
     * @returns {Promise<string>} - The resolved address.
     */
    static async resolveAddressAtHeight(networkProperties, namespaceId, height) {
        const endpoint = `${networkProperties.nodeUrl}/statements/resolutions/address?height=${height}&pageSize=100`;
        const { data } = await makeRequest(endpoint);
        const statement = data.find((statement) => namespaceIdFromRaw(statement.statement.unresolved) === namespaceId);
        const { resolved } = statement.statement.resolutionEntries[0];

        return addressFromRaw(resolved);
    }

    /**
     * Fetches the address currently linked to a namespace id.
     * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
     * @param {string} namespaceId - Requested namespace id.
     * @returns {Promise<string>} - The resolved address.
     */
    static async resolveAddress(networkProperties, namespaceId) {
        let namespace;

        try {
            namespace = await NamespaceService.fetchNamespaceInfo(networkProperties, namespaceId);
        } catch (error) {
            if (e.message === 'error_fetch_not_found') {
                throw new Error('error_unknown_account_name');
            } else {
                throw error;
            }
        }

        if (!namespace.alias.address) {
            throw new Error('error_unknown_account_name');
        }

        return addressFromRaw(namespace.alias.address);
    }
}
