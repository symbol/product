import { makeRequest } from '@/utils/server';
import { createAPIURL } from '@/_variants/symbol/utils';

export const fetchFinalizationInfo = async () => {
    const props = await makeRequest(createAPIURL('network/properties'));
    const chain = await makeRequest(createAPIURL('chain/info'));

    const chainHeight = Number(chain.height);
    const finalizationHeight = Number(chain.latestFinalizedBlock.height);

    const epochEnd = chain.latestFinalizedBlock.finalizationEpoch;
    const epochStart = epochEnd - 1;

    const grouping = Number(props.chain.votingSetGrouping);
    const blockTimeSec = Number(props.chain.blockGenerationTargetTime.replace('s', ''));

    const previousEpochHeight = (epochStart - 1) * grouping;
    const currentEpochHeight = epochStart * grouping;

    const remainingBlocks = currentEpochHeight - finalizationHeight;
    const epochEndEtaSeconds = remainingBlocks * blockTimeSec;
    const epochEndEtaTimestamp = new Date(Date.now() + epochEndEtaSeconds * 1000);

    return  {
        chainHeight,
        finalizationHeight,
        epochStart,
        epochEnd,
        remainingBlocks,
        previousEpochHeight,
        currentEpochHeight,
        epochEndEtaTimestamp
    }
}
