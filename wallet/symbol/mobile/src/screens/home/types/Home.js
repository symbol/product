/** @typedef {import('react')} React */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Price').Price} Price */

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
 * Widget config.
 * @typedef {object} HomeWidgetItem
 * @property {string} id - Random unique key.
 * @property {function(object): React.ReactNode} Component - Widget component.
 */

/**
 * Home screen config.
 * @typedef {object} HomeScreenConfig
 * @property {HomeWidgetItem[]} widgets - List of widgets that will be rendered on the Home screen.
 */

export {};
