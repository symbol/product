/** @typedef {import('@/app/types/Token').Token} Token */

/**
 * Dropdown option for selecting sender address.
 * @typedef {Object} SenderOption
 * @property {string} value - The sender address.
 * @property {string} label - The display label (name or address).
 */

/**
 * Route parameters for the Send screen.
 * @typedef {Object} SendRouteParams
 * @property {string} [chainName] - The blockchain name.
 * @property {string} [senderAddress] - Pre-filled sender address.
 * @property {string} [recipientAddress] - Pre-filled recipient address.
 * @property {string} [tokenId] - Pre-selected token identifier.
 * @property {string} [amount] - Pre-filled amount.
 * @property {Object} [message] - Pre-filled message object.
 * @property {string} [message.text] - Pre-filled message text.
 */

export {};
