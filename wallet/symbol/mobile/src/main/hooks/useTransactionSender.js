import { useProp } from './useProp';
import { useMultisigAccountList } from '@/app/screens/multisig/hooks/useMultisigAccountList';

/** @typedef {import('@/app/types/Wallet').MainWalletController} MainWalletController */
/** @typedef {import('@/app/types/Account').SymbolAccountInfo} SymbolAccountInfo */

/**
 * The current account in the shape expected by SelectTransactionSender.
 * @typedef {object} SenderCurrentAccount
 * @property {string} address - The current account address.
 * @property {string} balance - The current account balance.
 */

/**
 * The accounts a transaction can be sent from.
 * @typedef {object} SenderOptions
 * @property {SenderCurrentAccount} current - The current account (address and balance).
 * @property {SymbolAccountInfo[]} multisigAccounts - The multisig accounts the current account can send from.
 */

/**
 * Return type for useTransactionSender hook.
 * @typedef {object} UseTransactionSenderReturnType
 * @property {SenderOptions} options - The selectable sender accounts (current and multisig).
 * @property {string} value - The selected sender address.
 * @property {(address: string) => void} changeValue - Updates the selected sender address.
 * @property {SymbolAccountInfo} selectedAccount - The resolved account info of the selected sender.
 * @property {boolean} isMultisigSelected - Whether a multisig account is the selected sender.
 * @property {() => void} load - Fetches the multisig account list.
 * @property {() => void} reset - Resets the multisig account list state.
 * @property {boolean} isLoading - Whether the multisig account list is being fetched.
 */

/**
 * React hook providing the data and selection state for the SelectTransactionSender control.
 * Owns the selected sender — defaulting to the current account and re-syncing when the current
 * account changes — and exposes the accounts that can send plus the resolved account info of the
 * selection. It does not load on its own: the screen triggers load and wires refresh, so the
 * fetch can be coordinated with the screen's other data.
 * @param {MainWalletController} walletController - The wallet controller instance.
 * @param {object} [params] - Hook parameters.
 * @param {string} [params.initialAddress] - Sender address to pre-select (e.g. From route params).
 * @returns {UseTransactionSenderReturnType}
 */
export const useTransactionSender = (walletController, { initialAddress } = {}) => {
	const { currentAccount } = walletController;
	const currentAccountInfo = walletController.currentAccountInfo || {};

	const { data: multisigAccounts, load, reset, isLoading } = useMultisigAccountList(walletController);

	const current = {
		address: currentAccount.address,
		balance: currentAccountInfo.balance ?? '0'
	};

	// Selected sender address; resets to the current account whenever the current account changes
	const [value, changeValue] = useProp(initialAddress || current.address);
	const isMultisigSelected = value !== current.address;

	const selectedAccount = isMultisigSelected
		? multisigAccounts.find(account => account.address === value)
		: { ...currentAccountInfo, address: currentAccount.address, publicKey: currentAccount.publicKey };

	return {
		options: { current, multisigAccounts },
		value,
		changeValue,
		selectedAccount,
		isMultisigSelected,
		load,
		reset,
		isLoading
	};
};
