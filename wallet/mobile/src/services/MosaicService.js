import { makeRequest } from 'src/utils';
import { NamespaceService } from './';

export class MosaicService {
    static async fetchMosaicInfo(networkProperties, mosaicId) {
        const mosaicInfos = await MosaicService.fetchMosaicInfos(networkProperties, [mosaicId]);

        return mosaicInfos[mosaicId];
    }

    static async fetchMosaicInfos(networkProperties, mosaicIds) {
        const endpoint = `${networkProperties.nodeUrl}/mosaics`;
        const payload = {
            mosaicIds
        };
        const data = await makeRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json'
            },
        });
        const mosaicInfosEntires = data.map(mosaicInfos => [mosaicInfos.mosaic.id, mosaicInfos.mosaic]);
        const mosaicInfos = Object.fromEntries(mosaicInfosEntires);

        const mosaicNames = await NamespaceService.fetchMosaicNames(networkProperties, mosaicIds);

        for (const mosaicId in mosaicNames) {
            mosaicInfos[mosaicId].names = mosaicNames[mosaicId];
        }
        console.log('wallet/fetchMosaicInfos', {mosaicIds, mosaicInfos});
        return mosaicInfos;
    }
}
