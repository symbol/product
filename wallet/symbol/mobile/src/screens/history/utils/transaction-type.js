import { SymbolTransactionType } from '@/app/constants';
import { $t } from '@/app/localization';
import { isIncomingTransaction, isOutgoingTransaction } from 'wallet-common-symbol/src/utils/transaction';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */

/**
 * Gets the action text for a transaction based on type and direction.
 * @param {Transaction} transaction - Transaction object.
 * @param {WalletAccount} currentAccount - Current account.
 * @returns {string} Localized transaction type text.
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
