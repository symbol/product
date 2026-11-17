import { walletControllers } from '@/app/lib/controller';

/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */

/**
 * Loads a wallet controller by initializing cache and connecting to network.
 * @param {WalletController} walletController - The wallet controller to load.
 * @returns {Promise<void>}
 */
export const loadWalletController = async walletController => {
	await walletController.loadCache();
    
	if (walletController.networkIdentifier !== walletControllers.main.networkIdentifier)
		await walletController.selectNetwork(walletControllers.main.networkIdentifier);

	await walletController.connectToNetwork();
};
