/** @typedef {import('wallet-common-core').WalletController} WalletController */

/**
 * @typedef {Object} WalletWorkflow
 * @property {function(): Promise<void>} loadCache - Function to load cache for all wallet controllers.
 * @property {function(): Promise<void>} connectToNetwork - Function to connect all wallet controllers to the network.
 */

/**
 * Hook providing workflow management functions for wallet controllers.
 * This hook encapsulates common wallet operations such as loading cached data
 * and establishing network connections across multiple wallet controllers.
 *
 * @param {Object} options - Hook options.
 * @param {WalletController[]} options.walletControllers - Array of wallet controller instances to manage.
 * @returns {WalletWorkflow} Object containing workflow functions for wallet management.
 */
export const useWalletWorkflow = ({ walletControllers }) => {
	const loadCache = async () => {
		await Promise.all(walletControllers.map(controller => controller.loadCache()));
	};
	const connectToNetwork = async () => {
		await Promise.all(walletControllers.map(controller => controller.connectToNetwork()));
	};

	return {
		loadCache,
		connectToNetwork
	};
};
