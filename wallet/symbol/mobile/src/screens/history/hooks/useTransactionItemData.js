import { 
	getTransactionDescription, 
	getTransactionIconName, 
	getTransactionTypeText 
} from '../utils';
import { TransactionGroup } from '@/app/constants';
import { $t } from '@/app/localization';
import { formatDate } from '@/app/utils';
import { useMemo } from 'react';
import { isTransactionAwaitingSignatureByAccount } from 'wallet-common-symbol/src/utils/transaction';

/**
 * @typedef {object} TransactionDisplayData
 * @property {string} iconName - Icon type for the transaction
 * @property {string} action - Action text for the transaction
 * @property {string} description - Description text for the transaction
 * @property {string} dateText - Date/status text for the transaction
 * @property {boolean} isAwaitingAccountSignature - Whether the transaction is awaiting signature
 */

/**
 * Gets the date/status text for a transaction.
 * @param {object} transaction - Transaction object
 * @param {string} group - Transaction group
 * @param {boolean} isDateHidden - Whether to hide the date
 * @returns {string} Date or status text
 */
const getTransactionDateText = (transaction, group, isDateHidden) => {
	if (isDateHidden)
		return '';

	const { deadline, timestamp } = transaction;

	if (group === TransactionGroup.UNCONFIRMED || group === TransactionGroup.PARTIAL) {
		const deadlineText = formatDate(deadline?.timestamp, $t, true);
		return $t('transaction_awaitingConfirmation', { deadline: deadlineText });
	}

	const dateValue = timestamp ?? deadline?.timestamp;
	return formatDate(dateValue, $t, true);
};

/**
 * Hook for computing transaction display data.
 *
 * @param {object} options - Hook options
 * @param {object} options.transaction - Transaction object
 * @param {string} options.group - Transaction group (confirmed, unconfirmed, partial)
 * @param {object} options.currentAccount - Current account
 * @param {Array} options.walletAccounts - Wallet accounts for the network
 * @param {object} options.addressBook - Address book instance
 * @param {string} options.chainName - Chain name (e.g., 'symbol')
 * @param {string} options.networkIdentifier - Network identifier (e.g., 'mainnet')
 * @param {boolean} [options.isDateHidden=false] - Whether to hide the date
 *
 * @returns {TransactionDisplayData} Transaction display data
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
		const dateText = getTransactionDateText(transaction, group, isDateHidden);

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
