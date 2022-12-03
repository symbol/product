import { makeRequest } from 'src/utils';

export class MosaicService {
    static async fetchMosaicInfo(networkProperties, mosaicId) {
        const mosaicInfos = await MosaicService.fetchMosaicInfos(networkProperties, [mosaicId]);

        return mosaicInfos[0];
    }

    static async fetchMosaicInfos(networkProperties, mosaicIds) {
        const endpoint = `${networkProperties.nodeUrl}/mosaics`;
        const payload = {
            mosaicIds
        };
        const mosaicInfos = await makeRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json'
            },
        });
        
        return mosaicInfos.map(mosaicInfos => mosaicInfos.mosaic);
    }
}
