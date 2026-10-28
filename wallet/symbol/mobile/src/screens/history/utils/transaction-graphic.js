import { TransactionGraphicAvatarType } from '@/app/constants';
import { createTransactionGraphicContent, getTransactionTypeInfo } from '@/app/lib/transaction';
import { $t } from '@/app/localization';
import { createAccountDisplayData } from '@/app/utils/account';
import { createTokenDisplayData } from '@/app/utils/token';

/** @typedef {import('@/app/screens/history/types/TransactionGraphic').TransactionGraphicData} TransactionGraphicData */
/** @typedef {import('@/app/screens/history/types/TransactionGraphic').TransactionGraphicSide} TransactionGraphicSide */
/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Transaction').TransactionGraphicTarget} TransactionGraphicTarget */
/** @typedef {import('@/app/types/Transaction').TransactionGraphicOptions} TransactionGraphicOptions */

/**
 * Creates the source side data from the transaction.
 * Source is always the transaction signer.
 * @param {Transaction} transaction - The transaction.
 * @param {TransactionGraphicOptions} options - Options for creating the graphic data.
 * @returns {TransactionGraphicSide} Source side data.
 */
const createSourceData = (transaction, options) => {
	const { chainName, networkIdentifier, walletAccounts, addressBook } = options;
	const address = transaction.signerAddress || '';
	const accountDisplayData = createAccountDisplayData(address, {
		chainName,
		networkIdentifier,
		walletAccounts,
		addressBook
	});

	return {
		type: TransactionGraphicAvatarType.ACCOUNT,
		text: accountDisplayData.name ?? address,
		accountAddress: address,
		imageId: accountDisplayData.imageId,
		color: accountDisplayData.color
	};
};

/**
 * Creates the target side data from the target that the config (content) describes.
 * @param {TransactionGraphicTarget} target - The graphic target.
 * @param {TransactionGraphicOptions} options - Options for creating the graphic data.
 * @returns {TransactionGraphicSide} Target side data.
 */
const createTargetData = (target, options) => {
	const { chainName, networkIdentifier, walletAccounts, addressBook } = options;
	const { type: targetType } = target;

	// Handle account type targets
	if (targetType === TransactionGraphicAvatarType.ACCOUNT) {
		const address = target.value || '';
		const accountDisplayData = createAccountDisplayData(address, {
			chainName,
			networkIdentifier,
			walletAccounts,
			addressBook
		});

		return {
			type: targetType,
			text: accountDisplayData.name ?? address,
			accountAddress: address,
			imageId: accountDisplayData.imageId,
			color: accountDisplayData.color
		};
	}

	// Handle token type targets
	if (targetType === TransactionGraphicAvatarType.TOKEN) {
		const tokenId = target.value || '';
		const tokenDisplayData = createTokenDisplayData(
			{ id: tokenId },
			chainName,
			networkIdentifier
		);

		return {
			type: targetType,
			text: tokenDisplayData.nameText,
			imageId: tokenDisplayData.imageId
		};
	}

	// Handle namespace and lock types (no account/token display data needed)
	return { type: targetType, text: target.value || '' };
};

/**
 * Creates the transaction graphic view model from transaction.
 * @param {Transaction} transaction - Transaction to convert into graphic display data.
 * @param {TransactionGraphicOptions} options - Options for creating the graphic data.
 * @returns {TransactionGraphicData} Transaction graphic data.
 */
export const createTransactionGraphicData = (transaction, options) => {
	const content = createTransactionGraphicContent(transaction, options);
	const typeText = $t(getTransactionTypeInfo(transaction.type, options.chainName).localeKey);

	// Fallback for unsupported transaction types
	if (!content) {
		const sourceData = createSourceData(transaction, options);

		return {
			typeText,
			source: sourceData,
			target: {
				type: TransactionGraphicAvatarType.ACCOUNT,
				text: sourceData.text,
				accountAddress: sourceData.accountAddress,
				imageId: sourceData.imageId,
				color: sourceData.color
			},
			arrowCaptions: []
		};
	}

	return {
		typeText,
		source: createSourceData(transaction, options),
		target: createTargetData(content.target, options),
		arrowCaptions: content.arrowCaptions.filter(caption => caption.value)
	};
};
