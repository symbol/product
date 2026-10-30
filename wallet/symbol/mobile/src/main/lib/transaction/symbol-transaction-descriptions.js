import { getTransferDescriptionText } from './common-transaction-descriptions';
import { getSymbolTransactionTypeInfo } from './symbol-transaction-types';
import { $t } from '@/app/localization';
import { getAccountKnownInfo } from '@/app/utils/account';
import { AliasAction, AliasActionMessage, TransactionType } from 'wallet-common-symbol/src/constants';
import { isHarvestingServiceTransaction } from 'wallet-common-symbol/src/utils/transaction';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Account').AccountResolveOptions} AccountResolveOptions */

/**
 * Returns the localization key for an alias transaction.
 * @param {Transaction} transaction - Alias transaction object.
 * @returns {string} Localization key.
 */
const getAliasDescriptionKey = transaction =>
	transaction.aliasAction === AliasActionMessage[AliasAction.Unlink]
		? 'transactionDescriptionShort_aliasUnlink'
		: 'transactionDescriptionShort_alias';

/**
 * Returns description for an aggregate transaction.
 * @param {Transaction} transaction - Aggregate transaction object.
 * @returns {string} Description text string.
 */
const getAggregateDescriptionText = transaction => {
	const firstTransactionType = transaction.innerTransactions[0]?.type;
	const innerTypeText = firstTransactionType
		? $t(getSymbolTransactionTypeInfo(firstTransactionType).localeKey)
		: '';
	const count = transaction.innerTransactions.length - 1;

	return count
		? $t('transactionDescriptionShort_aggregateMultiple', { type: innerTypeText, count })
		: innerTypeText;
};

/**
 * Returns description for the Symbol transaction.
 * @param {Transaction} transaction - Transaction object.
 * @param {WalletAccount} currentAccount - Current account.
 * @param {AccountResolveOptions} resolveOptions - Options for resolving account info.
 * @returns {string} Description text string.
 */
export const getSymbolTransactionDescriptionText = (transaction, currentAccount, resolveOptions) => {
	switch (transaction.type) {
	case TransactionType.AGGREGATE_COMPLETE:
	case TransactionType.AGGREGATE_BONDED:
		if (isHarvestingServiceTransaction(transaction))
			return $t('transactionDescriptionShort_aggregateHarvesting');

		return getAggregateDescriptionText(transaction);

	case TransactionType.TRANSFER:
		return getTransferDescriptionText(transaction, currentAccount, resolveOptions);

	case TransactionType.NAMESPACE_REGISTRATION:
		return $t('transactionDescriptionShort_namespaceRegistration', { name: transaction.namespaceName });

	case TransactionType.ADDRESS_ALIAS: {
		const knownInfo = getAccountKnownInfo(transaction.address, resolveOptions);
		const displayName = knownInfo?.name ?? transaction.address;
		return $t(getAliasDescriptionKey(transaction), { target: displayName, name: transaction.namespaceName });
	}

	case TransactionType.MOSAIC_ALIAS:
		return $t(getAliasDescriptionKey(transaction), { target: transaction.tokenId, name: transaction.namespaceName });

	case TransactionType.MOSAIC_DEFINITION:
	case TransactionType.MOSAIC_SUPPLY_CHANGE:
	case TransactionType.MOSAIC_SUPPLY_REVOCATION:
		return $t('transactionDescriptionShort_mosaic', { id: transaction.tokenId });

	case TransactionType.ACCOUNT_MOSAIC_RESTRICTION:
	case TransactionType.ACCOUNT_ADDRESS_RESTRICTION:
	case TransactionType.ACCOUNT_OPERATION_RESTRICTION:
		return $t(`fieldValue_${transaction.restrictionType}`);

	case TransactionType.MOSAIC_GLOBAL_RESTRICTION:
	case TransactionType.MOSAIC_ADDRESS_RESTRICTION:
		return $t('transactionDescriptionShort_mosaicRestriction', { id: transaction.tokenId || transaction.referenceTokenId });

	case TransactionType.VRF_KEY_LINK:
	case TransactionType.NODE_KEY_LINK:
	case TransactionType.VOTING_KEY_LINK:
	case TransactionType.ACCOUNT_KEY_LINK:
		return $t(`fieldValue_${transaction.linkAction}`);

	case TransactionType.HASH_LOCK:
		return $t('transactionDescriptionShort_hashLock', { duration: transaction.duration });

	case TransactionType.SECRET_LOCK:
	case TransactionType.SECRET_PROOF:
		return transaction.secret;

	default:
		return '';
	}
};
