/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Price').Price} Price */
/** @typedef {import('@/app/types/RefreshController').RefreshController} RefreshController */

/**
 * Account card widget props.
 * @typedef {object} AccountCardWidgetProps
 * @property {string} address - Account address to display.
 * @property {string} balance - Account balance amount.
 * @property {string} name - Account name.
 * @property {Price} price - Token price for user currency conversion.
 * @property {string} ticker - Currency ticker.
 * @property {NetworkIdentifier} networkIdentifier - Network identifier.
 * @property {boolean} [isMultisig=false] - Whether the account is a multisig account.
 * @property {function(string): void} onNameChange - Callback when account name is changed.
 */

/**
 * Props that the Home screen passes to every brand home widget.
 * @typedef {object} HomeWidgetProps
 * @property {RefreshController} refreshController - Home screen refresh controller.
 */

export {};
