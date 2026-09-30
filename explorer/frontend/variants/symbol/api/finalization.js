import { fetchChainStatus } from './blocks';
import config from '@/app/config';
import { makeRequest } from '@/app/utils/server';

// Not part of API_CONTRACT: consumed only by the variant Finalization component.

/**
 * @typedef FinalizationInfo
 * @property {number} chainHeight - the chain height.
 * @property {number} finalizationHeight - the latest finalized block height.
 * @property {number} epochStart - the current finalization epoch.
 * @property {number} epochEnd - the next finalization epoch.
 * @property {number} epochProgress - the current epoch completion fraction (0..1).
 * @property {number} remainingBlocks - the blocks left until the current epoch finalizes.
 * @property {Date|null} epochEndEtaTimestamp - the estimated time the current epoch finalizes, null when no blocks remain.
 */

/**
 * Fetches the chain and finalization state from Nodewatch and maps it to the finalization info.
 * Returns null while Nodewatch has no collected data yet.
 * @returns {Promise<FinalizationInfo|null>} the finalization info.
 */
export const fetchFinalizationInfo = async () => {
	const [chainStatus, epochResponse, networkConfig] = await Promise.all([
		fetchChainStatus(),
		makeRequest(`${config.PUBLIC_NODEWATCH_URL}/api/symbol/epoch`),
		makeRequest(`${config.PUBLIC_NODEWATCH_URL}/api/symbol/network/config`)
	]);

	const { height: chainHeight, finalizedHeight: finalizationHeight } = chainStatus;
	const epochEnd = Number(epochResponse.epoch);
	const votingSetGrouping = Number(networkConfig.votingSetGrouping);
	const blockTimeSeconds = Number(networkConfig.targetBlockGenerationTime);

	// Nodewatch reports height 1 and epoch 0 while it has no collected data.
	const hasData = 1 < chainHeight && 0 < epochEnd && 0 < votingSetGrouping && 0 < blockTimeSeconds;

	if (!hasData)
		return null;

	const epochStart = epochEnd - 1;
	const previousEpochHeight = (epochStart - 1) * votingSetGrouping;
	const currentEpochHeight = epochStart * votingSetGrouping;

	// The height and epoch come from separate Nodewatch aggregations, so the derived values are clamped to the epoch bounds.
	const remainingBlocks = Math.min(Math.max(currentEpochHeight - finalizationHeight, 0), votingSetGrouping);
	const rawEpochProgress = (finalizationHeight - previousEpochHeight) / (currentEpochHeight - previousEpochHeight);
	const epochProgress = Math.min(Math.max(rawEpochProgress, 0), 1);
	const epochEndEtaTimestamp = 0 < remainingBlocks ? new Date(Date.now() + (remainingBlocks * blockTimeSeconds * 1000)) : null;

	return {
		chainHeight,
		finalizationHeight,
		epochStart,
		epochEnd,
		epochProgress,
		remainingBlocks,
		epochEndEtaTimestamp
	};
};
