import { useAsyncManager, useTransactionListener, useWalletListener } from '@/app/hooks';
import { DB_UPDATE_LATENCY_AFTER_ANNOUNCE } from '@/app/screens/history/constants';
import { TransactionGroup } from 'wallet-common-core/src/constants';

/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */

const FIRST_PAGE_NUMBER = 1;
const PAGE_SIZE = 15;

/**
 * Props for the HistoryWidget component.
 * @typedef {Object} HistoryWidgetProps
 * @property {Transaction[]} unconfirmed - Unconfirmed transactions.
 * @property {Transaction[]} partial - Partial (pending multisig) transactions.
 * @property {string} chainName - Chain name (e.g., 'symbol').
 * @property {NetworkIdentifier} networkIdentifier - Network identifier.
 * @property {string} ticker - Ticker symbol for the network currency.
 * @property {WalletAccount} currentAccount - Current user account.
 * @property {WalletAccount[]} walletAccounts - Wallet accounts for the network.
 * @property {Object} addressBook - Address book instance.
 */

/**
 * @typedef {Object} UseHistoryWidgetResult
 * @property {boolean} isVisible - Whether the widget should be visible.
 * @property {function(): void} refresh - Function to refresh transaction data.
 * @property {HistoryWidgetProps} props - Props for the HistoryWidget component.
 */

/**
 * React hook for managing the history widget state. Fetches unconfirmed and
 * partial transactions, and listens to wallet events for auto-refresh.
 *
 * @param {WalletController} walletController - Wallet controller instance.
 * @returns {UseHistoryWidgetResult} Widget state and props.
 */
export const useHistoryWidget = walletController => {
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

	const refresh = () => {
		setTimeout(() => {
			unconfirmedManager.call();
			partialManager.call();
		}, DB_UPDATE_LATENCY_AFTER_ANNOUNCE);
	};
	const clear = () => {
		unconfirmedManager.reset();
		partialManager.reset();
	};

	const handleTransactionStatusChange = () => {
		refresh();
	};
	const handleNetworkConnected = () => {
		refresh();
	};
	const handleAccountChange = () => {
		clear();
		
		if (walletController.isWalletReady)
			refresh();
	};

	useTransactionListener({
		walletControllers: [walletController],
		onTransactionConfirmed: handleTransactionStatusChange,
		onTransactionUnconfirmed: handleTransactionStatusChange,
		onTransactionPartial: handleTransactionStatusChange,
		onTransactionError: handleTransactionStatusChange
	});

	useWalletListener({
		walletControllers: [walletController],
		onAccountChange: handleAccountChange,
		onNetworkConnected: handleNetworkConnected
	});

	return {
		isVisible: unconfirmedManager.data.length > 0 || partialManager.data.length > 0,
		refresh,
		props: {
			unconfirmed: unconfirmedManager.data,
			partial: partialManager.data,
			chainName: walletController.chainName,
			networkIdentifier: walletController.networkIdentifier,
			ticker: walletController.ticker,
			currentAccount: walletController.currentAccount,
			walletAccounts: walletController.accounts[walletController.networkIdentifier],
			addressBook: walletController.modules.addressBook
		}
	};
};
