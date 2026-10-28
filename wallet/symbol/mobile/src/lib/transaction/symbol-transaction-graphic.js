import { createTransferGraphicContent, truncateHashCaption } from './common-transaction-graphic';
import { TransactionGraphicAvatarType, TransactionGraphicCaptionType } from '@/app/constants';
import { $t } from '@/app/localization';
import { getSignedSupplyDelta } from '@/app/utils/transaction';
import { TransactionType } from 'wallet-common-symbol/src/constants';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Transaction').TransactionGraphicContent} TransactionGraphicContent */
/** @typedef {import('@/app/types/Transaction').TransactionGraphicOptions} TransactionGraphicOptions */

/**
 * Creates transaction graphic content for the Symbol transaction.
 * @param {Transaction} transaction - Symbol transaction object.
 * @param {TransactionGraphicOptions} options - Options for creating the graphic data.
 * @returns {TransactionGraphicContent|null} Graphic content or null for unsupported types.
 */
export const createSymbolTransactionGraphicContent = (transaction, options) => {
	switch (transaction.type) {
	case TransactionType.TRANSFER:
		return createTransferGraphicContent(transaction, options);

	case TransactionType.NAMESPACE_REGISTRATION:
		return {
			target: { type: TransactionGraphicAvatarType.NAMESPACE, value: transaction.namespaceName },
			arrowCaptions: []
		};

	case TransactionType.MOSAIC_ALIAS:
		return {
			target: { type: TransactionGraphicAvatarType.TOKEN, value: transaction.tokenId },
			arrowCaptions: [{ type: TransactionGraphicCaptionType.TEXT, value: transaction.namespaceName }]
		};

	case TransactionType.ADDRESS_ALIAS:
		return {
			target: { type: TransactionGraphicAvatarType.ACCOUNT, value: transaction.address },
			arrowCaptions: [{ type: TransactionGraphicCaptionType.TEXT, value: transaction.namespaceName }]
		};

	case TransactionType.MOSAIC_DEFINITION:
		return {
			target: { type: TransactionGraphicAvatarType.TOKEN, value: transaction.tokenId },
			arrowCaptions: []
		};

	case TransactionType.MOSAIC_SUPPLY_CHANGE:
		return {
			target: { type: TransactionGraphicAvatarType.TOKEN, value: transaction.tokenId },
			arrowCaptions: [{ type: TransactionGraphicCaptionType.TEXT, value: `${getSignedSupplyDelta(transaction)}` }]
		};

	case TransactionType.MOSAIC_SUPPLY_REVOCATION:
		return {
			target: { type: TransactionGraphicAvatarType.ACCOUNT, value: transaction.sourceAddress },
			arrowCaptions: [
				{ type: TransactionGraphicCaptionType.ICON, value: 'tokens' },
				{ type: TransactionGraphicCaptionType.TEXT, value: transaction.tokenId }
			]
		};

	case TransactionType.ACCOUNT_MOSAIC_RESTRICTION:
	case TransactionType.ACCOUNT_ADDRESS_RESTRICTION:
	case TransactionType.ACCOUNT_OPERATION_RESTRICTION:
		return {
			target: { type: TransactionGraphicAvatarType.ACCOUNT, value: transaction.signerAddress },
			arrowCaptions: [{ type: TransactionGraphicCaptionType.TEXT, value: $t(`fieldValue_${transaction.restrictionType}`) }]
		};

	case TransactionType.MOSAIC_GLOBAL_RESTRICTION: {
		const { restrictionKey, newRestrictionType, newRestrictionValue } = transaction;

		return {
			target: { type: TransactionGraphicAvatarType.TOKEN, value: transaction.referenceTokenId },
			arrowCaptions: [
				{ type: TransactionGraphicCaptionType.TEXT, value: `${restrictionKey} ${$t(`fieldValue_${newRestrictionType}`)} ${newRestrictionValue}` }
			]
		};
	}

	case TransactionType.MOSAIC_ADDRESS_RESTRICTION:
		return {
			target: { type: TransactionGraphicAvatarType.ACCOUNT, value: transaction.targetAddress },
			arrowCaptions: [{ type: TransactionGraphicCaptionType.TEXT, value: `${transaction.restrictionKey} = ${transaction.newRestrictionValue}` }]
		};

	case TransactionType.MULTISIG_ACCOUNT_MODIFICATION:
		return {
			target: { type: TransactionGraphicAvatarType.ACCOUNT, value: transaction.signerAddress },
			arrowCaptions: []
		};

	case TransactionType.VRF_KEY_LINK:
	case TransactionType.NODE_KEY_LINK:
	case TransactionType.VOTING_KEY_LINK:
	case TransactionType.ACCOUNT_KEY_LINK:
		return {
			target: { type: TransactionGraphicAvatarType.ACCOUNT, value: transaction.linkedAccountAddress },
			arrowCaptions: [{ type: TransactionGraphicCaptionType.TEXT, value: $t(`fieldValue_${transaction.linkAction}`) }]
		};

	case TransactionType.HASH_LOCK:
		return {
			target: {
				type: TransactionGraphicAvatarType.LOCK,
				value: $t('transactionDescriptionShort_hashLock', { duration: transaction.duration })
			},
			arrowCaptions: [
				{ type: TransactionGraphicCaptionType.TEXT, value: `${transaction.lockedAmount} ${options.nativeCurrencyTicker}` }
			]
		};

	case TransactionType.SECRET_LOCK:
	case TransactionType.SECRET_PROOF:
		return {
			target: { type: TransactionGraphicAvatarType.LOCK, value: '' },
			arrowCaptions: [{ type: TransactionGraphicCaptionType.TEXT, value: truncateHashCaption(transaction.secret) }]
		};

	case TransactionType.ACCOUNT_METADATA:
		return {
			target: { type: TransactionGraphicAvatarType.ACCOUNT, value: transaction.targetAddress },
			arrowCaptions: [{ type: TransactionGraphicCaptionType.TEXT, value: transaction.scopedMetadataKey }]
		};

	case TransactionType.NAMESPACE_METADATA:
		return {
			target: { type: TransactionGraphicAvatarType.NAMESPACE, value: transaction.targetNamespaceId },
			arrowCaptions: [{ type: TransactionGraphicCaptionType.TEXT, value: transaction.scopedMetadataKey }]
		};

	case TransactionType.MOSAIC_METADATA:
		return {
			target: { type: TransactionGraphicAvatarType.TOKEN, value: transaction.targetTokenId },
			arrowCaptions: [{ type: TransactionGraphicCaptionType.TEXT, value: transaction.scopedMetadataKey }]
		};

	default:
		return null;
	}
};
