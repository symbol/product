import { makeRequest } from 'src/utils';
import _ from 'lodash';

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
}
