import { bridges } from '@/app/lib/controller';
import { BridgePairsStatus } from '@/app/screens/bridge/types/Bridge';
import { loadWalletController } from '@/app/screens/bridge/utils';
import { useCallback, useEffect, useState } from 'react';
import { ControllerEventName } from 'wallet-common-core/src/constants';

/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapWorkflowManager} SwapWorkflowManager */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapPair} SwapPair */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgePairsStatusType} BridgePairsStatusType */
/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */

/**
 * Checks if both wallet controllers in a bridge have accounts.
 * @param {SwapWorkflowManager} bridge - The bridge manager instance.
 * @returns {boolean} True if both controllers have accounts.
 */
const isBridgeControllersHaveAccounts = bridge =>
	bridge.sourceWalletController.hasAccounts &&
	bridge.targetWalletController.hasAccounts;

/**
 * Checks if both wallet controllers in a bridge have loaded their cache.
 * @param {SwapWorkflowManager} bridge - The bridge manager instance.
 * @returns {boolean} True if both controllers have loaded cache.
 */
const isBridgeControllersCacheLoaded = bridge =>
	bridge.sourceWalletController.isStateReady &&
	bridge.targetWalletController.isStateReady;

/**
 * Checks if both wallet controllers in a bridge are connected to the network.
 * @param {SwapWorkflowManager} bridge - The bridge manager instance.
 * @returns {boolean} True if both controllers are connected.
 */
const isBridgeControllersNetworkConnected = bridge =>
	bridge.sourceWalletController.isNetworkConnectionReady &&
	bridge.targetWalletController.isNetworkConnectionReady;

/**
 * Checks if a bridge is fully ready (cache loaded, has accounts, and connected).
 * @param {SwapWorkflowManager} bridge - The bridge manager instance.
 * @returns {boolean} True if the bridge is fully ready.
 */
const isBridgeControllersReady = bridge =>
	isBridgeControllersCacheLoaded(bridge) &&
	isBridgeControllersHaveAccounts(bridge) &&
	isBridgeControllersNetworkConnected(bridge);

/**
 * Extracts all wallet controllers from an array of bridges.
 * @param {SwapWorkflowManager[]} bridges - Array of bridge managers.
 * @returns {WalletController[]} Array of wallet controllers.
 */
const getBridgesWalletControllers = bridges => {
	const seen = new Set();

	return bridges.reduce((controllers, bridge) => {
		[bridge.sourceWalletController, bridge.targetWalletController].forEach(controller => {
			if (!seen.has(controller)) {
				seen.add(controller);
				controllers.push(controller);
			}
		});
		return controllers;
	}, []);
};

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
	const sourceTokenBalance = sourceAccountTokens.find(t => t.id === sourceTokenInfo.id)?.amount || '0';

	const { targetWalletController, targetTokenInfo } = bridge;

	const targetAccountTokens = targetWalletController.currentAccountInfo?.tokens
		|| targetWalletController.currentAccountInfo?.mosaics
		|| [];
	const targetTokenBalance = targetAccountTokens.find(t => t.id === targetTokenInfo.id)?.amount || '0';

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
 * Creates swap pairs for all bridges. Each bridge already encodes a fixed direction.
 * @param {SwapWorkflowManager[]} bridges - Array of bridge managers.
 * @returns {SwapPair[]} Array of swap pairs.
 */
const createSwapPairs = bridges => bridges.map(bridge => createSwapPair(bridge));

/**
 * Return type for useBridge hook.
 * @typedef {object} UseBridgeReturnType
 * @property {SwapWorkflowManager[]} bridges - Array of available bridge managers.
 * @property {SwapPair[]} pairs - Array of available swap pairs.
 * @property {BridgePairsStatusType} pairsStatus - Current status of swap pairs loading.
 * @property {() => Promise<void>} loadBridges - Loads all ready bridges.
 * @property {() => Promise<void>} loadWalletControllers - Loads wallet controllers that aren't ready.
 * @property {() => Promise<void>} fetchBalances - Fetches account balances for all wallet controllers.
 */

/**
 * React hook for managing bridge operations, swap pairs, and wallet controller lifecycle.
 * Handles loading bridges, creating swap pairs, and subscribing to account and network changes.
 * @returns {UseBridgeReturnType}
 */
export const useBridge = () => {
	const [pairs, setPairs] = useState([]);
	const [pairsStatus, setPairsStatus] = useState(BridgePairsStatus.LOADING);

	const updatePairs = () => {
		const bridgesWithLoadedCache = bridges.filter(isBridgeControllersCacheLoaded);
		const bridgesWithAccounts = bridgesWithLoadedCache.filter(isBridgeControllersHaveAccounts);
		const bridgesWithNetworkConnection = bridgesWithAccounts.filter(isBridgeControllersNetworkConnected);

		setPairs(createSwapPairs(bridgesWithNetworkConnection));

		const hasBridgesWithLoadedCache = bridgesWithLoadedCache.length > 0;
		const hasBridgesWithAccounts = bridgesWithAccounts.length > 0;

		const setPairsStatusIfDifferent = newStatus => {
			if (pairsStatus !== newStatus)
				setPairsStatus(newStatus);
		};

		if (bridges.length === 0)
			setPairsStatusIfDifferent(BridgePairsStatus.NOT_CONFIGURED);
		else if (!hasBridgesWithLoadedCache)
			setPairsStatusIfDifferent(BridgePairsStatus.LOADING);
		else if (hasBridgesWithLoadedCache && !hasBridgesWithAccounts)
			setPairsStatusIfDifferent(BridgePairsStatus.NO_PAIRS);
		else if (hasBridgesWithLoadedCache && hasBridgesWithAccounts)
			setPairsStatusIfDifferent(BridgePairsStatus.OK);
	};

	const fetchBalances = useCallback(async () => {
		const walletControllers = getBridgesWalletControllers(bridges);
		const readyControllers = walletControllers.filter(controller =>
			controller.isWalletReady && controller.hasAccounts);
		await Promise.all(readyControllers.map(controller => controller.fetchAccountInfo()));
		updatePairs();
	}, [bridges]);

	const loadWalletControllers = useCallback(async () => {
		const walletControllers = getBridgesWalletControllers(bridges);
		const notReadyControllers = walletControllers.filter(controller => !controller.isStateReady);

		await Promise.all(notReadyControllers.map(controller => loadWalletController(controller)));
	}, [bridges]);

	const loadBridges = useCallback(async () => {
		const readyBridges = bridges.filter(isBridgeControllersReady);
		await Promise.all(readyBridges.map(bridge => bridge.load()));
		updatePairs();
	}, [bridges]);

	const subscribe = () => {
		const walletControllers = getBridgesWalletControllers(bridges);

		const unsubscribes = walletControllers.map(controller => {
			const fetchControllerBalance = async () => {
				await controller.fetchAccountInfo();
				updatePairs();
			};

			controller.on(ControllerEventName.ACCOUNT_CHANGE, loadBridges);
			controller.on(ControllerEventName.NETWORK_CONNECTED, loadBridges);
			controller.on(ControllerEventName.NEW_TRANSACTION_CONFIRMED, fetchControllerBalance);

			return () => {
				controller.removeListener(ControllerEventName.ACCOUNT_CHANGE, loadBridges);
				controller.removeListener(ControllerEventName.NETWORK_CONNECTED, loadBridges);
				controller.removeListener(ControllerEventName.NEW_TRANSACTION_CONFIRMED, fetchControllerBalance);
			};
		});

		return () => unsubscribes.forEach(unsubscribe => unsubscribe());
	};

	const init = useCallback(async () => {
		await loadWalletControllers();
		await loadBridges();
		await fetchBalances();
	}, [loadWalletControllers, loadBridges, fetchBalances]);

	useEffect(() => {
		init();

		return subscribe();
	}, [init]);

	return { bridges, pairs, pairsStatus, loadBridges, loadWalletControllers, fetchBalances };
};
