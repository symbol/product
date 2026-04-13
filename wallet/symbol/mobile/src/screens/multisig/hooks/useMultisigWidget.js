import { useWalletRefreshLifecycle } from '@/app/hooks';
import { useMultisigAccountList } from '@/app/screens/multisig/hooks/useMultisigAccountList';

/** @typedef {import('@/app/types/Wallet').MainWalletController} MainWalletController */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Account').SymbolAccountInfo} SymbolAccountInfo */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */

/**
 * @typedef {Object} MultisigWidgetProps
 * @property {SymbolAccountInfo[]} multisigAccountList - List of multisig accounts.
 * @property {string} chainName - The blockchain name.
 * @property {NetworkIdentifier} networkIdentifier - The network identifier.
 * @property {string} ticker - The native currency ticker symbol.
 * @property {WalletAccount} currentAccount - The current wallet account.
 * @property {WalletAccount[]} walletAccounts - Wallet accounts for the current network.
 * @property {object} addressBook - The address book module instance.
 */

/**
 * @typedef {Object} UseMultisigWidgetReturnType
 * @property {boolean} isVisible - Whether the widget should be shown (true when multisig accounts exist).
 * @property {() => void} refresh - Refreshes the multisig account list.
 * @property {boolean} isLoading - Whether data is being fetched.
 * @property {MultisigWidgetProps} props - Props to pass to the MultisigWidget component.
 */

/**
 * React hook for managing the multisig widget state and data for the home screen.
 * Provides visibility control and widget props derived from the wallet controller.
 * Listens to wallet events for auto-refresh.
 *
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
			chainName: walletController.chainName,
			networkIdentifier: walletController.networkIdentifier,
			ticker: walletController.ticker,
			currentAccount: walletController.currentAccount,
			walletAccounts: walletController.accounts[walletController.networkIdentifier],
			addressBook: walletController.modules.addressBook
		}
	};
};
