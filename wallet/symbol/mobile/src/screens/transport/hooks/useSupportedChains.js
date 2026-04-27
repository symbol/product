import { useReactiveWalletControllers } from '@/app/hooks';
import { walletControllers as controllers } from '@/app/lib/controller';

/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */

/**
 * Extracts chain names from an array of wallet controllers.
 * @param {WalletController[]} walletControllers - Array of wallet controllers.
 * @returns {string[]} Array of chain names.
 */
const getChainNames = walletControllers => walletControllers.map(controller => controller.chainName);

/**
 * Extracts chain names from wallet controllers that have an active account.
 * @param {WalletController[]} walletControllers - Array of wallet controllers.
 * @returns {string[]} Array of active chain names.
 */
const getActiveChainNames = walletControllers =>
	walletControllers
		.filter(controller => !!controller.currentAccount)
		.map(controller => controller.chainName);

/**
 * Return type for useSupportedChains hook.
 * @typedef {Object} UseSupportedChainsReturnType
 * @property {string[]} supported - Array of chain names supported by the wallet.
 * @property {string[]} active - Array of chain names with an active account selected.
 */

/**
 * React hook that provides the list of supported and active chain names from all wallet controllers.
 * A chain is considered supported if it has a wallet controller configured.
 * A chain is considered active if its wallet controller has a current account selected.
 * @returns {UseSupportedChainsReturnType}
 */
export const useSupportedChains = () => {
	const walletControllers = useReactiveWalletControllers([controllers.main, ...controllers.additional]);

	const supported = getChainNames(walletControllers);
	const active = getActiveChainNames(walletControllers);

	return { supported, active };
};
