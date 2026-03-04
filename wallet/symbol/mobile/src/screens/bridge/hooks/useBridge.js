import { bridges } from '@/app/lib/controller';
import { BridgeMode, BridgePairsStatus } from '@/app/screens/bridge/types/Bridge';
import { loadWalletController } from '@/app/screens/bridge/utils';
import { useCallback, useEffect, useState } from 'react';
import { ControllerEventName } from 'wallet-common-core/src/constants';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeManager} BridgeManager */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapPair} SwapPair */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgePairsStatusType} BridgePairsStatusType */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeModeType} BridgeModeType */
/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */

/**
 * Checks if both wallet controllers in a bridge have accounts.
 * @param {BridgeManager} bridge - The bridge manager instance.
 * @returns {boolean} True if both controllers have accounts.
 */
const isBridgeControllersHaveAccounts = bridge =>
	bridge.nativeWalletController.hasAccounts &&
	bridge.wrappedWalletController.hasAccounts;

/**
 * Checks if both wallet controllers in a bridge have loaded their cache.
 * @param {BridgeManager} bridge - The bridge manager instance.
 * @returns {boolean} True if both controllers have loaded cache.
 */
const isBridgeControllersCacheLoaded = bridge =>
	bridge.nativeWalletController.isStateReady &&
	bridge.wrappedWalletController.isStateReady;

/**
 * Checks if both wallet controllers in a bridge are connected to the network.
 * @param {BridgeManager} bridge - The bridge manager instance.
 * @returns {boolean} True if both controllers are connected.
 */
const isBridgeControllersNetworkConnected = bridge =>
	bridge.nativeWalletController.isNetworkConnectionReady &&
	bridge.wrappedWalletController.isNetworkConnectionReady;

/**
 * Checks if a bridge is fully ready (cache loaded, has accounts, and connected).
 * @param {BridgeManager} bridge - The bridge manager instance.
 * @returns {boolean} True if the bridge is fully ready.
 */
const isBridgeControllersReady = bridge =>
	isBridgeControllersCacheLoaded(bridge) &&
	isBridgeControllersHaveAccounts(bridge) &&
	isBridgeControllersNetworkConnected(bridge);

/**
 * Extracts all wallet controllers from an array of bridges.
 * @param {BridgeManager[]} bridges - Array of bridge managers.
 * @returns {WalletController[]} Array of wallet controllers.
 */
const getBridgesWalletControllers = bridges => {
	return bridges.reduce((controllers, bridge) => {
		controllers.push(bridge.nativeWalletController);
		controllers.push(bridge.wrappedWalletController);
		return controllers;
	}, []);
};

/**
 * Creates a swap pair object from a bridge and mode.
 * @param {BridgeManager} bridge - The bridge manager instance.
 * @param {BridgeModeType} mode - The bridge operation mode.
 * @returns {SwapPair} The created swap pair.
 */
const createSwapPair = (bridge, mode) => {
	const sourceWalletController = mode === BridgeMode.WRAP
		? bridge.nativeWalletController
		: bridge.wrappedWalletController;

	const sourceTokenInfo = mode === BridgeMode.WRAP
		? bridge.nativeTokenInfo
		: bridge.wrappedTokenInfo;

	const sourceAccountTokens = sourceWalletController.currentAccountInfo?.tokens
		|| sourceWalletController.currentAccountInfo?.mosaics
		|| [];
	const sourceTokenBalance = sourceAccountTokens.find(t => t.id === sourceTokenInfo.id)?.amount || '0';

	const targetWalletController = mode === BridgeMode.WRAP
		? bridge.wrappedWalletController
		: bridge.nativeWalletController;

	const targetTokenInfo = mode === BridgeMode.WRAP
		? bridge.wrappedTokenInfo
		: bridge.nativeTokenInfo;

	const targetAccountTokens = targetWalletController.currentAccountInfo?.tokens
		|| targetWalletController.currentAccountInfo?.mosaics
		|| [];
	const targetTokenBalance = targetAccountTokens.find(t => t.id === targetTokenInfo.id)?.amount || '0';

	return {
		bridge,
		mode,
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
 * Creates swap pairs for all bridges (both wrap and unwrap modes).
 * @param {BridgeManager[]} bridges - Array of bridge managers.
 * @returns {SwapPair[]} Array of swap pairs.
 */
const createSwapPairs = bridges => {
	const pairs = [];

	bridges.forEach(bridge => {
		pairs.push(createSwapPair(bridge, BridgeMode.WRAP));
		pairs.push(createSwapPair(bridge, BridgeMode.UNWRAP));
	});

	return pairs;
};

/**
 * Return type for useBridge hook.
 * @typedef {Object} UseBridgeReturnType
 * @property {BridgeManager[]} bridges - Array of available bridge managers.
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

		if (!hasBridgesWithLoadedCache)
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
