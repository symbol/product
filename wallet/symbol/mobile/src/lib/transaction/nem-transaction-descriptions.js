import { getTransferDescriptionText } from './common-transaction-descriptions';
import { getNemTransactionTypeInfo } from './nem-transaction-types';
import { $t } from '@/app/localization';
import { getAccountKnownInfo } from '@/app/utils/account';
import { TransactionType } from 'wallet-common-nem/src/constants';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Account').AccountResolveOptions} AccountResolveOptions */

/**
 * Returns description for the NEM transaction.
 * @param {Transaction} transaction - Transaction object.
 * @param {WalletAccount} currentAccount - Current account.
 * @param {AccountResolveOptions} resolveOptions - Options for resolving account info.
 * @returns {string} Description text string.
 */
export const getNemTransactionDescriptionText = (transaction, currentAccount, resolveOptions) => {
	switch (transaction.type) {
	case TransactionType.TRANSFER:
		return getTransferDescriptionText(transaction, currentAccount, resolveOptions);

	case TransactionType.MULTISIG: {
		const innerTransaction = transaction.innerTransactions[0];

		return innerTransaction ? $t(getNemTransactionTypeInfo(innerTransaction.type).localeKey) : '';
	}

	case TransactionType.MULTISIG_ACCOUNT_MODIFICATION: {
		const knownInfo = getAccountKnownInfo(transaction.signerAddress, resolveOptions);

		return knownInfo?.name ?? transaction.signerAddress;
	}

	case TransactionType.ACCOUNT_KEY_LINK:
		return $t(`fieldValue_${transaction.linkAction}`);

	case TransactionType.NAMESPACE_REGISTRATION:
		return $t('transactionDescriptionShort_namespaceRegistration', { name: transaction.namespaceName });

	case TransactionType.MOSAIC_DEFINITION:
	case TransactionType.MOSAIC_SUPPLY_CHANGE:
		return $t('transactionDescriptionShort_mosaic', { id: transaction.tokenId });

	default:
		return '';
	}
};
