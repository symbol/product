import { useWalletRefreshLifecycle } from '@/app/hooks';
import { useMultisigAccountList } from '@/app/screens/multisig/hooks/useMultisigAccountList';

/** @typedef {import('@/app/types/Wallet').MainWalletController} MainWalletController */
/** @typedef {import('@/app/types/Account').SymbolAccountInfo} SymbolAccountInfo */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * Props passed to the MultisigWidget component.
 * @typedef {object} MultisigWidgetProps
 * @property {SymbolAccountInfo[]} multisigAccountList - List of multisig accounts.
 * @property {ChainName} chainName - The blockchain name.
 */

/**
 * Return type of the useMultisigWidget hook.
 * @typedef {object} UseMultisigWidgetReturnType
 * @property {boolean} isVisible - Whether the widget should be shown (true when multisig accounts exist).
 * @property {() => void} refresh - Refreshes the multisig account list.
 * @property {boolean} isLoading - Whether data is being fetched.
 * @property {MultisigWidgetProps} props - Props to pass to the MultisigWidget component.
 */

/**
 * React hook for managing the multisig widget state and data for the home screen.
 * Provides visibility control and widget props derived from the wallet controller.
 * Listens to wallet events for auto-refresh.
 * @param {MainWalletController} walletController - The wallet controller instance.
 * @returns {UseMultisigWidgetReturnType}
 */
export const useMultisigWidget = walletController => {
	const { data, load, reset, isLoading } = useMultisigAccountList(walletController);

	// Subscribe to wallet events for auto-refresh
	useWalletRefreshLifecycle({
		walletController,
		onRefresh: load,
		onClear: reset
	});

	return {
		isVisible: data.length > 0,
		refresh: load,
		isLoading,
		props: {
			multisigAccountList: data,
			chainName: walletController.chainName
		}
	};
};
