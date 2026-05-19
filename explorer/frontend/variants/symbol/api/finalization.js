import { fetchChainHight } from './blocks';
import { fetchSymbolNode } from '../utils';

export const fetchFinalizationInfo = async () => {
	const [properties, chainHeight] = await Promise.all([
		fetchSymbolNode('network/properties'),
		fetchChainHight()
	]);
	const chain = await fetchSymbolNode('chain/info');
	const latestFinalizedBlock = chain.latestFinalizedBlock || {};
	const finalizationHeight = Number(latestFinalizedBlock.height || 0);
	const epochEnd = Number(latestFinalizedBlock.finalizationEpoch || 0);
	const epochStart = Math.max(epochEnd - 1, 0);
	const grouping = Number(properties.chain?.votingSetGrouping || 1);
	const blockTimeSec = Number(`${properties.chain?.blockGenerationTargetTime || '30s'}`.replace('s', ''));
	const previousEpochHeight = Math.max((epochStart - 1) * grouping, 0);
	const currentEpochHeight = Math.max(epochStart * grouping, 1);
	const remainingBlocks = Math.max(currentEpochHeight - finalizationHeight, 0);
	const epochEndEtaTimestamp = new Date(Date.now() + (remainingBlocks * blockTimeSec * 1000)).toISOString();

	return {
		chainHeight,
		finalizationHeight,
		epochStart,
		epochEnd,
		remainingBlocks,
		previousEpochHeight,
		currentEpochHeight,
		epochEndEtaTimestamp
	};
};
