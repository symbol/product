import { bridges } from '@/app/lib/controller';
import { BridgePairsStatus } from '@/app/screens/bridge/types/Bridge';
import { getBridgePairs, isBridgeControllersReady, loadWalletController } from '@/app/screens/bridge/utils';
import { useCallback, useEffect, useState } from 'react';
import { ControllerEventName } from 'wallet-common-core/src/constants';

/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapWorkflowManager} SwapWorkflowManager */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapPair} SwapPair */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgePairsStatusType} BridgePairsStatusType */
/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */

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
		const { pairs, status } = getBridgePairs(bridges);

		setPairs(pairs);
		setPairsStatus(previousStatus => previousStatus === status ? previousStatus : status);
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
