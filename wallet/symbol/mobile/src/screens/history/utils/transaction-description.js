import { SymbolTransactionType } from '@/app/constants';
import { $t } from '@/app/localization';
import { getAccountKnownInfo } from '@/app/utils';
import {
	isAggregateTransaction,
	isHarvestingServiceTransaction,
	isIncomingTransaction,
	isOutgoingTransaction
} from 'wallet-common-symbol/src/utils/transaction';

/**
 * Gets the description for a transfer transaction.
 * @param {object} transaction - Transaction object
 * @param {object} currentAccount - Current account
 * @param {object} resolveOptions - Options for resolving account info
 * @returns {string} Transfer description
 */
const getTransferDescription = (transaction, currentAccount, resolveOptions) => {
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

/**
 * Gets the description for an aggregate transaction.
 * @param {object} transaction - Transaction object
 * @returns {string} Aggregate description
 */
const getAggregateDescription = transaction => {
	if (isHarvestingServiceTransaction(transaction))
		return $t('transactionDescriptionShort_aggregateHarvesting');

	const firstTransactionType = transaction.innerTransactions[0]?.type;
	const innerTypeText = firstTransactionType ? $t(`transactionDescriptor_${firstTransactionType}`) : '';
	const count = transaction.innerTransactions.length - 1;

	return count
		? $t('transactionDescriptionShort_aggregateMultiple', { type: innerTypeText, count })
		: innerTypeText;
};

/**
 * Gets the description text for a transaction.
 * @param {object} transaction - Transaction object
 * @param {object} currentAccount - Current account
 * @param {object} resolveOptions - Options for resolving account info
 * @returns {string} Description text
 */
export const getTransactionDescription = (transaction, currentAccount, resolveOptions) => {
	const { type } = transaction;

	if (isAggregateTransaction(transaction))
		return getAggregateDescription(transaction);

	switch (type) {
	case SymbolTransactionType.TRANSFER:
		return getTransferDescription(transaction, currentAccount, resolveOptions);

	case SymbolTransactionType.NAMESPACE_REGISTRATION:
		return $t('transactionDescriptionShort_namespaceRegistration', { name: transaction.namespaceName });

	case SymbolTransactionType.ADDRESS_ALIAS: {
		const knownInfo = getAccountKnownInfo(transaction.address, resolveOptions);
		const displayName = knownInfo?.name ?? transaction.address;
		return $t('transactionDescriptionShort_alias', { target: displayName, name: transaction.namespaceName });
	}

	case SymbolTransactionType.MOSAIC_ALIAS:
		return $t('transactionDescriptionShort_alias', { target: transaction.mosaicId, name: transaction.namespaceName });

	case SymbolTransactionType.MOSAIC_DEFINITION:
	case SymbolTransactionType.MOSAIC_SUPPLY_CHANGE:
	case SymbolTransactionType.MOSAIC_SUPPLY_REVOCATION:
		return $t('transactionDescriptionShort_mosaic', { id: transaction.mosaicId });

	case SymbolTransactionType.ACCOUNT_MOSAIC_RESTRICTION:
	case SymbolTransactionType.ACCOUNT_ADDRESS_RESTRICTION:
	case SymbolTransactionType.ACCOUNT_OPERATION_RESTRICTION:
		return $t(`data_${transaction.restrictionType}`);

	case SymbolTransactionType.MOSAIC_GLOBAL_RESTRICTION:
	case SymbolTransactionType.MOSAIC_ADDRESS_RESTRICTION:
		return $t('transactionDescriptionShort_mosaicRestriction', { id: transaction.mosaicId || transaction.referenceMosaicId });

	case SymbolTransactionType.VRF_KEY_LINK:
	case SymbolTransactionType.NODE_KEY_LINK:
	case SymbolTransactionType.VOTING_KEY_LINK:
	case SymbolTransactionType.ACCOUNT_KEY_LINK:
		return $t(`data_${transaction.linkAction}`);

	case SymbolTransactionType.HASH_LOCK:
		return $t('transactionDescriptionShort_hashLock', { duration: transaction.duration });

	case SymbolTransactionType.SECRET_LOCK:
	case SymbolTransactionType.SECRET_PROOF:
		return transaction.secret;

	default:
		return '';
	}
};
