/**
 * Transaction graphic avatar type.
 * @typedef {'account' | 'token' | 'namespace' | 'lock'} TransactionGraphicAvatarType
 */

/**
 * Transaction graphic caption content type.
 * @typedef {'text' | 'icon'} CaptionType
 */

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
 * Transaction graphic caption configuration.
 * @typedef {object} TransactionGraphicArrowCaption
 * @property {CaptionType} type - Type of content to render.
 * @property {string} value - Text string to render or icon name.
 */

/**
 * Transaction graphic view model.
 * @typedef {object} TransactionGraphicData
 * @property {string} typeText - Localized transaction type label.
 * @property {TransactionGraphicSide} source - Source side display data.
 * @property {TransactionGraphicSide} target - Target side display data.
 * @property {TransactionGraphicArrowCaption[]} arrowCaptions - Content rendered inside the arrow.
 */


export const TransactionGraphicAvatarType = {
	ACCOUNT: /** @type {TransactionGraphicAvatarType} */ ('account'),
	TOKEN: /** @type {TransactionGraphicAvatarType} */ ('token'),
	NAMESPACE: /** @type {TransactionGraphicAvatarType} */ ('namespace'),
	LOCK: /** @type {TransactionGraphicAvatarType} */ ('lock')
};

export const CaptionType = {
	TEXT: /** @type {CaptionType} */ ('text'),
	ICON: /** @type {CaptionType} */ ('icon')
};

export {};
