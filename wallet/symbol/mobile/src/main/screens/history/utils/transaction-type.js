import { SymbolTransactionType, TransactionDirection } from '@/app/constants';
import { $t } from '@/app/localization';
import { getTransactionTypeLocaleKey } from '@/app/utils';
import { isIncomingTransaction, isOutgoingTransaction } from 'wallet-common-symbol/src/utils/transaction';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * Gets the action text for a transaction based on type and direction.
 * @param {Transaction} transaction - Transaction object.
 * @param {WalletAccount} currentAccount - Current account.
 * @param {ChainName} chainName - Chain name, used to namespace the descriptor key.
 * @returns {string} Localized transaction type text.
 */
export const getTransactionTypeText = (transaction, currentAccount, chainName) => {
	const { type } = transaction;
	const isTransfer = type === SymbolTransactionType.TRANSFER;

	if (isTransfer && isOutgoingTransaction(transaction, currentAccount))
		return $t(getTransactionTypeLocaleKey(type, chainName, TransactionDirection.OUTGOING));

	if (isTransfer && isIncomingTransaction(transaction, currentAccount))
		return $t(getTransactionTypeLocaleKey(type, chainName, TransactionDirection.INCOMING));

	return $t(getTransactionTypeLocaleKey(type, chainName));
};
