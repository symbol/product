import { BridgePairsStatus } from '@/app/screens/bridge/types/Bridge';

/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapWorkflowManager} SwapWorkflowManager */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapPair} SwapPair */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgePairsStatusType} BridgePairsStatusType */

/**
 * Checks if both wallet controllers in a bridge have loaded their cache.
 * @param {SwapWorkflowManager} bridge - The bridge manager instance.
 * @returns {boolean} True if both controllers have loaded cache.
 */
const isBridgeControllersCacheLoaded = bridge =>
	bridge.sourceWalletController.isStateReady &&
	bridge.targetWalletController.isStateReady;

/**
 * Checks if both wallet controllers in a bridge have accounts.
 * @param {SwapWorkflowManager} bridge - The bridge manager instance.
 * @returns {boolean} True if both controllers have accounts.
 */
const isBridgeControllersHaveAccounts = bridge =>
	bridge.sourceWalletController.hasAccounts &&
	bridge.targetWalletController.hasAccounts;

/**
 * Checks if both wallet controllers in a bridge are connected to the network.
 * @param {SwapWorkflowManager} bridge - The bridge manager instance.
 * @returns {boolean} True if both controllers are connected.
 */
const isBridgeControllersNetworkConnected = bridge =>
	bridge.sourceWalletController.isNetworkConnectionReady &&
	bridge.targetWalletController.isNetworkConnectionReady;

/**
 * Creates a swap pair object from a bridge (direction is fixed in the bridge itself).
 * @param {SwapWorkflowManager} bridge - The bridge manager instance.
 * @returns {SwapPair} The created swap pair.
 */
const createSwapPair = bridge => {
	const { sourceWalletController, sourceTokenInfo } = bridge;

	const sourceAccountTokens = sourceWalletController.currentAccountInfo?.tokens
		|| sourceWalletController.currentAccountInfo?.mosaics
		|| [];
	const sourceTokenBalance = sourceAccountTokens.find(token => token.id === sourceTokenInfo.id)?.amount || '0';

	const { targetWalletController, targetTokenInfo } = bridge;

	const targetAccountTokens = targetWalletController.currentAccountInfo?.tokens
		|| targetWalletController.currentAccountInfo?.mosaics
		|| [];
	const targetTokenBalance = targetAccountTokens.find(token => token.id === targetTokenInfo.id)?.amount || '0';

	return {
		bridge,
		source: {
			token: {
				...sourceTokenInfo,
				amount: sourceTokenBalance
			},
			chainName: sourceWalletController.chainName,
			networkIdentifier: sourceWalletController.networkIdentifier,
			walletController: sourceWalletController
		},
		target: {
			token: {
				...targetTokenInfo,
				amount: targetTokenBalance
			},
			chainName: targetWalletController.chainName,
			networkIdentifier: targetWalletController.networkIdentifier,
			walletController: targetWalletController
		}
	};
};

/**
 * Checks if a bridge is fully ready (cache loaded, has accounts, and connected).
 * @param {SwapWorkflowManager} bridge - The bridge manager instance.
 * @returns {boolean} True if the bridge is fully ready.
 */
export const isBridgeControllersReady = bridge =>
	isBridgeControllersCacheLoaded(bridge) &&
	isBridgeControllersHaveAccounts(bridge) &&
	isBridgeControllersNetworkConnected(bridge);

/**
 * Result of deriving the bridge screen state from the configured bridges.
 * @typedef {object} BridgePairsData
 * @property {SwapPair[]} pairs - Swap pairs the user can choose from.
 * @property {BridgePairsStatusType} status - Status describing why the pairs look the way they do.
 */

/**
 * Derives the swap pairs and the status of the bridge screen from the configured bridges.
 * Both are produced together so that they can never disagree: an "ok" status always comes
 * with a non-empty pair list.
 * @param {SwapWorkflowManager[]} bridges - All configured bridges.
 * @returns {BridgePairsData} Pairs the user can swap and the status explaining the result.
 */
export const getBridgePairs = bridges => {
	const bridgesWithLoadedCache = bridges.filter(isBridgeControllersCacheLoaded);
	const bridgesWithAccounts = bridgesWithLoadedCache.filter(isBridgeControllersHaveAccounts);
	const bridgesWithNetworkConnection = bridgesWithAccounts.filter(isBridgeControllersNetworkConnected);
	const loadedBridges = bridgesWithNetworkConnection.filter(bridge => bridge.isReady);
	const enabledBridges = loadedBridges.filter(bridge => bridge.isEnabled);

	const hasBridgesWithLoadedCache = bridgesWithLoadedCache.length > 0;
	const hasBridgesWithAccounts = bridgesWithAccounts.length > 0;
	const hasLoadedBridges = loadedBridges.length > 0;
	const hasEnabledBridges = enabledBridges.length > 0;

	let status;

	if (bridges.length === 0)
		status = BridgePairsStatus.NOT_CONFIGURED;
	else if (!hasBridgesWithLoadedCache)
		status = BridgePairsStatus.LOADING;
	else if (!hasBridgesWithAccounts)
		status = BridgePairsStatus.NO_PAIRS;
	else if (!hasLoadedBridges)
		status = BridgePairsStatus.LOADING;
	else if (!hasEnabledBridges)
		status = BridgePairsStatus.DISABLED;
	else
		status = BridgePairsStatus.OK;

	return {
		pairs: enabledBridges.map(createSwapPair),
		status
	};
};
