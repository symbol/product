import { useEffect } from 'react';
import { constants } from 'wallet-common-core';
const { ControllerEventName } = constants;

/** @typedef {import('wallet-common-core').WalletController} WalletController */

/**
 * React hook that synchronizes the network type selection across multiple wallet controllers.
 * When the main wallet controller changes its selected network, this hook automatically
 * updates all additional wallet controllers to use the same network identifier.
 * @param {object} options - Hook options.
 * @param {WalletController} options.mainWalletController 
 * - The main wallet controller instance that drives network selection.
 * @param {WalletController[]} options.additionalWalletControllers 
 * - Array of additional wallet controller instances to keep in sync.
 * @returns {void}
 */
export const useSyncNetworkType = ({ mainWalletController, additionalWalletControllers }) => {
	useEffect(() => {
		const syncNetworkType = () => {
			additionalWalletControllers.forEach(controller => {
				if (controller.isStateReady)
					controller.selectNetwork(mainWalletController.networkIdentifier);
			});
		};

		syncNetworkType();
		mainWalletController.on(ControllerEventName.NETWORK_CHANGE, syncNetworkType);

		return () => {
			mainWalletController.removeListener(ControllerEventName.NETWORK_CHANGE, syncNetworkType);
		};
	}, []);
}; 
