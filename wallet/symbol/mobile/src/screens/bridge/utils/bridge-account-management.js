import { loadWalletController } from './wallet-controller';
import { walletControllers } from '@/app/lib/controller';

/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */

/**
 * Gets a wallet controller by chain name from additional controllers.
 * @param {string} chainName - The blockchain name.
 * @returns {WalletController|undefined} The wallet controller.
 */
const getWalletController = chainName => {
	return walletControllers.additional.find(controller => controller.chainName === chainName);
};

/**
 * Generates an account from the main wallet's mnemonic for a given chain.
 * @param {string} chainName - The blockchain name.
 * @returns {Promise<void>}
 */
export const generateFromMnemonic = async chainName => {
	const walletController = getWalletController(chainName);
	const mnemonic = await walletControllers.main.getMnemonic();
	await walletController.saveMnemonicAndGenerateAccounts({
		mnemonic,
		name: chainName,
		accountPerNetworkCount: 1
	});
	await loadWalletController(walletController);
};

/**
 * Imports an account using a private key for a given chain.
 * @param {string} chainName - The blockchain name.
 * @param {string} privateKey - The private key to import.
 * @returns {Promise<void>}
 */
export const importFromPrivateKey = async (chainName, privateKey) => {
	const walletController = getWalletController(chainName);
	await walletController.addExternalAccount({
		privateKey,
		name: chainName,
		networkIdentifier: walletControllers.main.networkIdentifier
	});
	await loadWalletController(walletController);
};

/**
 * Removes an account for a given chain by clearing the wallet controller.
 * @param {string} chainName - The blockchain name.
 * @returns {Promise<void>}
 */
export const removeAccount = async chainName => {
	const walletController = getWalletController(chainName);
	await walletController.clear();
};

