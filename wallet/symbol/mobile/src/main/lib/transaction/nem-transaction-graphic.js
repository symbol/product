import { createTransferGraphicContent, truncateHashCaption } from './common-transaction-graphic';
import { TransactionGraphicAvatarType, TransactionGraphicCaptionType } from '@/app/constants';
import { $t } from '@/app/localization';
import { getSignedSupplyDelta } from '@/app/utils/transaction';
import { TransactionType } from 'wallet-common-nem/src/constants';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Transaction').TransactionGraphicContent} TransactionGraphicContent */
/** @typedef {import('@/app/types/Transaction').TransactionGraphicOptions} TransactionGraphicOptions */

/**
 * Creates transaction graphic content for the NEM transaction.
 * @param {Transaction} transaction - NEM transaction object.
 * @param {TransactionGraphicOptions} options - Options for creating the graphic data.
 * @returns {TransactionGraphicContent|null} Graphic content or null for unsupported types.
 */
export const createNemTransactionGraphicContent = (transaction, options) => {
	switch (transaction.type) {
	case TransactionType.TRANSFER:
		return createTransferGraphicContent(transaction, options);

	case TransactionType.ACCOUNT_KEY_LINK:
		return {
			target: { type: TransactionGraphicAvatarType.ACCOUNT, value: transaction.linkedAccountAddress },
			arrowCaptions: [{ type: TransactionGraphicCaptionType.TEXT, value: $t(`fieldValue_${transaction.linkAction}`) }]
		};

	case TransactionType.MULTISIG_ACCOUNT_MODIFICATION:
		return {
			target: { type: TransactionGraphicAvatarType.ACCOUNT, value: transaction.signerAddress },
			arrowCaptions: []
		};

	case TransactionType.MULTISIG_COSIGNATURE:
		return {
			target: { type: TransactionGraphicAvatarType.ACCOUNT, value: transaction.multisigAddress }, 
			arrowCaptions: [{ type: TransactionGraphicCaptionType.TEXT, value: truncateHashCaption(transaction.otherTransactionHash) }]
		};

	case TransactionType.NAMESPACE_REGISTRATION:
		return {
			target: { type: TransactionGraphicAvatarType.NAMESPACE, value: transaction.namespaceName },
			arrowCaptions: []
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

	default:
		return null;
	}
};
