import { TransactionGraphicAvatarType, TransactionGraphicCaptionType } from '@/app/constants';
import { truncateMiddle } from '@/app/utils/format';
import { getNativeCurrencyToken, hasNonNativeCurrencyTokens } from '@/app/utils/token';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Transaction').TransactionGraphicContent} TransactionGraphicContent */
/** @typedef {import('@/app/types/Transaction').TransactionGraphicOptions} TransactionGraphicOptions */

const HASH_CAPTION_TRUNCATE_START = 8;
const HASH_CAPTION_TRUNCATE_END = 8;

/**
 * Truncates a text string to fit under the transaction graphic arrow caption. 
 * Usually used for long hashes, such as transaction hash or other.
 * @param {string} hash - The text string to truncate.
 * @returns {string} The truncated text string.
 */
export const truncateHashCaption = hash => truncateMiddle(hash, HASH_CAPTION_TRUNCATE_START, HASH_CAPTION_TRUNCATE_END);

/**
 * The shared basic transfer transaction graphic content creation helper.
 * Should be reused for most of the chains.
 * @param {Transaction} transaction - Transfer transaction.
 * @param {TransactionGraphicOptions} options - Options for creating the graphic data.
 * @returns {TransactionGraphicContent} Graphic content.
 */
export const createTransferGraphicContent = (transaction, options) => {
	const tokens = transaction.tokens || [];
	const nativeToken = getNativeCurrencyToken(tokens, options.nativeCurrencyTokenId);
	const hasCustomTokens = hasNonNativeCurrencyTokens(tokens, options.nativeCurrencyTokenId);

	return {
		target: { type: TransactionGraphicAvatarType.ACCOUNT, value: transaction.recipientAddress },
		arrowCaptions: [
			{ type: TransactionGraphicCaptionType.ICON, value: transaction.message ? 'message' : null },
			{ type: TransactionGraphicCaptionType.ICON, value: hasCustomTokens ? 'token-custom' : null },
			{ type: TransactionGraphicCaptionType.TEXT, value: `${nativeToken?.amount ?? '0'} ${options.nativeCurrencyTicker}` }
		]
	};
};
