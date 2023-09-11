import _ from 'lodash';
import { addressFromRaw, getMosaicRelativeAmountString, makeRequest } from 'src/utils';
import { NamespaceService } from './';
import { Constants } from 'src/config';

export class MosaicService {
    static async fetchMosaicInfo(networkProperties, mosaicId) {
        const mosaicInfos = await MosaicService.fetchMosaicInfos(networkProperties, [mosaicId]);

        return mosaicInfos[mosaicId];
    }

    static async fetchMosaicInfos(networkProperties, mosaicIds) {
        // Fetch mosaic infos from API
        const endpoint = `${networkProperties.nodeUrl}/mosaics`;
        const payload = {
            mosaicIds,
        };
        const data = await makeRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Create map <id, info> from response
        const mosaicInfosEntires = data.map((mosaicInfos) => {
            const duration = parseInt(mosaicInfos.mosaic.duration);
            const startHeight = parseInt(mosaicInfos.mosaic.startHeight);
            const endHeight = startHeight + duration;
            const isUnlimitedDuration = duration === 0;
            const creator = addressFromRaw(mosaicInfos.mosaic.ownerAddress);
            const supply = getMosaicRelativeAmountString(mosaicInfos.mosaic.supply, parseInt(mosaicInfos.mosaic.divisibility));
            const { flags } = mosaicInfos.mosaic;

            return [
                mosaicInfos.mosaic.id,
                {
                    ...mosaicInfos.mosaic,
                    duration,
                    startHeight,
                    endHeight,
                    isUnlimitedDuration,
                    creator,
                    supply,
                    isSupplyMutable: (flags & Constants.MosaicFlags.SUPPLY_MUTABLE) !== 0,
                    isTransferable: (flags & Constants.MosaicFlags.TRANSFERABLE) !== 0,
                    isRestrictable: (flags & Constants.MosaicFlags.RESTRICTABLE) !== 0,
                    isRevokable: (flags & Constants.MosaicFlags.REVOKABLE) !== 0,
                },
            ];
        });
        const mosaicInfos = Object.fromEntries(mosaicInfosEntires);

        // Find namespace ids if there are some in the mosaic list. Mosaic infos are not available for namespace ids
        const fetchedMosaicIds = Object.keys(mosaicInfos);
        const namespaceIds = _.difference(mosaicIds, fetchedMosaicIds);

        // Fetch namespace infos to extract mosaic ids from there
        const namespaceInfos = await NamespaceService.fetchNamespaceInfos(networkProperties, namespaceIds);
        const remainedMosaicIds = Object.values(namespaceInfos).map((namespaceInfo) => namespaceInfo.alias.mosaicId);
        const shouldFetchRemainedMosaicInfos = remainedMosaicIds.length > 0;

        // Fetch remained mosaic infos for extracted mosaics from namespace infos
        const remainedMosaicInfos = shouldFetchRemainedMosaicInfos
            ? await MosaicService.fetchMosaicInfos(networkProperties, remainedMosaicIds)
            : {};

        // Fetch mosaic names
        const mosaicIdsToFetchNames = _.difference(mosaicIds, namespaceIds);
        const mosaicNames = await NamespaceService.fetchMosaicNames(networkProperties, mosaicIdsToFetchNames);

        for (const mosaicId in mosaicNames) {
            mosaicInfos[mosaicId].names = mosaicNames[mosaicId];
        }

        for (const namespaceId of namespaceIds) {
            if (namespaceInfos[namespaceId]) {
                const mosaicId = namespaceInfos[namespaceId].alias.mosaicId;
                mosaicInfos[namespaceId] = remainedMosaicInfos[mosaicId];
            }
        }

        return { ...mosaicInfos, ...remainedMosaicInfos };
    }
}
