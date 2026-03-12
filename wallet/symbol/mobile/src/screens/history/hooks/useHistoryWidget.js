import { useAsyncManager, useTransactionListener, useWalletListener } from '@/app/hooks';
import { TransactionGroup } from 'wallet-common-core/src/constants';

const FIRST_PAGE_NUMBER = 1;
const PAGE_SIZE = 15;
const DB_UPDATE_LATENCY = 500;

/**
 * @typedef {Object} HistoryWidgetState
 * @property {boolean} isVisible - Indicates if the history widget should be visible based on transaction data.
 * @property {function} refresh - Function to refresh the transaction data.
 * @property {Object} props - Properties to be passed to the HistoryWidget component, including transaction arrays and account details.
 * @property {Array} props.unconfirmed - Array of unconfirmed transactions.
 * @property {Array} props.partial - Array of partial (pending multisig) transactions.
 * @property {string} props.chainName - The name of the blockchain network (e.g., 'symbol').
 * @property {string} props.networkIdentifier - The identifier for the network (e.g., 'mainnet').
 * @property {string} props.ticker - The ticker symbol for the network currency.
 * @property {Object} props.currentAccount - The current user account details.
 * @property {Object} props.walletAccounts - Wallet accounts organized by network.
 * @property {Object} props.addressBook - Address book instance for resolving transaction addresses.
 */

/**
 * Custom hook for managing the history widget state.
 * It fetches unconfirmed and partial transactions, listens to transaction and wallet changes,
 * and provides necessary props for rendering the history widget.
 *
 * @param {import('wallet-common-core').WalletController} walletController - The wallet controller instance.
 * @returns {HistoryWidgetState} State and props for the history widget component.
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
		}, DB_UPDATE_LATENCY);
	};
	const clear = () => {
		unconfirmedManager.reset();
		partialManager.reset();
	};

	const handleTransactionStatusChange = () => {
		refresh();
	};
	const handleAccountChange = () => {
		clear();
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
		onAccountChange: handleAccountChange
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
