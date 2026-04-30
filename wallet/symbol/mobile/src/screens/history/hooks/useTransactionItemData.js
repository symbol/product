import { 
	getTransactionDateText,
	getTransactionDescription, 
	getTransactionIconName, 
	getTransactionTypeText,
	isTransactionAwaitingSignatureByAccount
} from '../utils';
import { TransactionGroup } from '@/app/types/Transaction';
import { useMemo } from 'react';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * Computed display data for a transaction list item.
 * @typedef {object} TransactionDisplayData
 * @property {string} iconName - Icon name for the transaction.
 * @property {string} action - Action text for the transaction.
 * @property {string} description - Description text for the transaction.
 * @property {string} dateText - Date/status text for the transaction.
 * @property {boolean} isAwaitingAccountSignature - Whether transaction is awaiting signature.
 */

/**
 * React hook for computing transaction display data used in list items.
 * @param {object} options - Hook options.
 * @param {Transaction} options.transaction - Transaction object.
 * @param {string} options.group - Transaction group (confirmed, unconfirmed, partial).
 * @param {WalletAccount} options.currentAccount - Current account.
 * @param {WalletAccount[]} options.walletAccounts - Wallet accounts for the network.
 * @param {object} options.addressBook - Address book instance.
 * @param {ChainName} options.chainName - Chain name (e.g., 'symbol').
 * @param {NetworkIdentifier} options.networkIdentifier - Network identifier.
 * @param {boolean} [options.isDateHidden=false] - Whether to hide the date.
 * @returns {TransactionDisplayData} Transaction display data.
 */
export const useTransactionItemData = ({
	transaction,
	group,
	currentAccount,
	walletAccounts,
	addressBook,
	chainName,
	networkIdentifier,
	isDateHidden = false
}) => {
	return useMemo(() => {
		const resolveOptions = {
			walletAccounts,
			addressBook,
			chainName,
			networkIdentifier
		};

		const iconName = getTransactionIconName(transaction.type);
		const action = getTransactionTypeText(transaction, currentAccount);
		const description = getTransactionDescription(transaction, currentAccount, resolveOptions);
		const dateText = isDateHidden ? '' : getTransactionDateText(transaction, group);

		const isPartial = group === TransactionGroup.PARTIAL;
		const isAwaitingAccountSignature = isPartial && isTransactionAwaitingSignatureByAccount(transaction, currentAccount);

		return {
			iconName,
			action,
			description,
			dateText,
			isAwaitingAccountSignature
		};
	}, [transaction, group, currentAccount, walletAccounts, addressBook, chainName, networkIdentifier, isDateHidden]);
};
