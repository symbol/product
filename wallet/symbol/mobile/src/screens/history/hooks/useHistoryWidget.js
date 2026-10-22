import { TransactionGroup } from '@/app/constants';
import { useAsyncManager, useWalletRefreshLifecycle } from '@/app/hooks';

/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('@/app/types/RefreshController').RefreshController} RefreshController */
/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

const FIRST_PAGE_NUMBER = 1;
const PAGE_SIZE = 15;

/**
 * Props for the HistoryWidget component.
 * @typedef {object} HistoryWidgetProps
 * @property {Transaction[]} unconfirmed - Unconfirmed transactions.
 * @property {Transaction[]} partial - Partial (pending multisig) transactions.
 * @property {ChainName} chainName - Chain name (e.g., 'symbol').
 * @property {NetworkIdentifier} networkIdentifier - Network identifier.
 * @property {string} ticker - Ticker symbol for the network currency.
 * @property {WalletAccount} currentAccount - Current user account.
 * @property {boolean} isCurrentAccountMultisig - Whether the current account is a multisig account.
 * @property {WalletAccount[]} walletAccounts - Wallet accounts for the network.
 * @property {object} addressBook - Address book instance.
 */

/**
 * Return type of the useHistoryWidget hook.
 * @typedef {object} UseHistoryWidgetResult
 * @property {boolean} isVisible - Whether the widget should be visible.
 * @property {HistoryWidgetProps} props - Props for the HistoryWidget component.
 */

/**
 * React hook for managing the history widget state. Fetches unconfirmed and
 * partial transactions, and listens to wallet events for auto-refresh.
 * @param {WalletController} walletController - Wallet controller instance.
 * @param {RefreshController} refreshController - Screen refresh controller.
 * @returns {UseHistoryWidgetResult} Widget state and props.
 */
export const useHistoryWidget = (walletController, refreshController) => {
	const unconfirmedManager = useAsyncManager({
		callback: async () => walletController.fetchAccountTransactions({
			group: TransactionGroup.UNCONFIRMED,
			pageNumber: FIRST_PAGE_NUMBER,
			pageSize: PAGE_SIZE
		}),
		defaultData: []
	});

	const partialManager = useAsyncManager({
		callback: async () => walletController.fetchAccountTransactions({
			group: TransactionGroup.PARTIAL,
			pageNumber: FIRST_PAGE_NUMBER,
			pageSize: PAGE_SIZE
		}),
		defaultData: []
	});

	const load = () => {
		unconfirmedManager.call();
		partialManager.call();
	};
	const clear = () => {
		unconfirmedManager.reset();
		partialManager.reset();
	};

	useWalletRefreshLifecycle({
		walletController,
		refreshController,
		onRefresh: load,
		onClear: clear,
		hasPartialListener: true,
		hasErrorListener: true,
		hasUnconfirmedListener: true,
		shouldLoadOnMount: true
	});

	return {
		isVisible: unconfirmedManager.data.length > 0 || partialManager.data.length > 0,
		props: {
			unconfirmed: unconfirmedManager.data,
			partial: partialManager.data,
			chainName: walletController.chainName,
			networkIdentifier: walletController.networkIdentifier,
			ticker: walletController.ticker,
			currentAccount: walletController.currentAccount,
			isCurrentAccountMultisig: walletController.currentAccountInfo?.isMultisig ?? false,
			walletAccounts: walletController.accounts[walletController.networkIdentifier],
			addressBook: walletController.modules.addressBook
		}
	};
};
