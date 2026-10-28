/** @typedef {import('@/app/types/Transaction').TransactionGraphicAvatarType} TransactionGraphicAvatarType */
/** @typedef {import('@/app/types/Transaction').TransactionGraphicArrowCaption} TransactionGraphicArrowCaption */

/**
 * Represents one side of a transaction operation (source or target).
 * @typedef {object} TransactionGraphicSide
 * @property {TransactionGraphicAvatarType} type - Avatar type to render.
 * @property {string} text - Label rendered next to the avatar.
 * @property {string} [accountAddress] - Optional account address for account avatar type.
 * @property {string} [imageId] - Optional avatar image identifier.
 * @property {string} [color] - Optional color for the label text.
 */

/**
 * Transaction graphic view model.
 * @typedef {object} TransactionGraphicData
 * @property {string} typeText - Localized transaction type label.
 * @property {TransactionGraphicSide} source - Source side display data.
 * @property {TransactionGraphicSide} target - Target side display data.
 * @property {TransactionGraphicArrowCaption[]} arrowCaptions - Content rendered inside the arrow.
 */

export {};
