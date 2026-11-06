import { TransactionKind } from '@/app/constants';
import { getTransactionTypeInfo } from '@/app/lib/transaction';
import { $t } from '@/app/localization';
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
	const { kind, localeKey } = getTransactionTypeInfo(transaction.type, chainName);
	const isTransfer = kind === TransactionKind.TRANSFER;

	if (isTransfer && isOutgoingTransaction(transaction, currentAccount))
		return $t('transactionType_transferOutgoing');

	if (isTransfer && isIncomingTransaction(transaction, currentAccount))
		return $t('transactionType_transferIncoming');

	return $t(localeKey);
};
