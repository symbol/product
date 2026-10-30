/**
 * Data for a single action card on the actions screen.
 * @typedef {object} ActionItem
 * @property {string} id - Unique key of the card.
 * @property {string} titleKey - Translation key of the card title.
 * @property {string} descriptionKey - Translation key of the card description.
 * @property {number} imageSource - The image source for the card (require result).
 * @property {boolean} isDisabledForMultisig - Whether the card is disabled for a multisig account.
 * @property {function(): void} onPress - Callback function when the card is pressed.
 */

/**
 * Actions screen config.
 * @typedef {object} ActionsScreenConfig
 * @property {ActionItem[]} cards - Cards in display order.
 */

export default {};
