import { SymbolTransactionType } from '@/app/constants';
import { $t } from '@/app/localization';
import { isIncomingTransaction, isOutgoingTransaction } from 'wallet-common-symbol/src/utils/transaction';

/**
 * Gets the action text for a transaction.
 * @param {object} transaction - Transaction object
 * @param {object} currentAccount - Current account
 * @returns {string} Transaction type text for display
 */
export const getTransactionTypeText = (transaction, currentAccount) => {
	const { type } = transaction;
	const isTransfer = type === SymbolTransactionType.TRANSFER;

	if (isTransfer && isOutgoingTransaction(transaction, currentAccount))
		return $t(`transactionDescriptor_${type}_outgoing`);
    
	if (isTransfer && isIncomingTransaction(transaction, currentAccount))
		return $t(`transactionDescriptor_${type}_incoming`);

	return $t(`transactionDescriptor_${type}`);
};
