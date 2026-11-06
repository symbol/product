import { $t } from '@/app/localization';
import { getAccountKnownInfo } from '@/app/utils/account';
import { isIncomingTransaction, isOutgoingTransaction } from 'wallet-common-symbol/src/utils/transaction';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Account').AccountResolveOptions} AccountResolveOptions */

/**
 * The shared getter for the transfer transaction description.
 * @param {Transaction} transaction - Transaction object.
 * @param {WalletAccount} currentAccount - Current account.
 * @param {AccountResolveOptions} resolveOptions - Options for resolving account info.
 * @returns {string} Transfer description.
 */
export const getTransferDescriptionText = (transaction, currentAccount, resolveOptions) => {
	const { signerAddress, recipientAddress } = transaction;
	const isOutgoing = isOutgoingTransaction(transaction, currentAccount);
	const isIncoming = isIncomingTransaction(transaction, currentAccount);
	const targetAddress = isOutgoing ? recipientAddress : signerAddress;

	const knownInfo = getAccountKnownInfo(targetAddress, resolveOptions);
	const hasName = Boolean(knownInfo?.name);

	if (!hasName && isOutgoing)
		return $t('transactionDescriptionShort_transferOutgoing');

	if (!hasName && isIncoming)
		return $t('transactionDescriptionShort_transferIncoming');

	if (isOutgoing)
		return $t('transactionDescriptionShort_transferTo', { address: knownInfo.name });

	if (isIncoming)
		return $t('transactionDescriptionShort_transferFrom', { address: knownInfo.name });

	return $t('transactionDescriptionShort_transferIrrelevant');
};
