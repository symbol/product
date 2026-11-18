/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('@/app/types/Price').Price} Price */
/** @typedef {import('@/app/types/RefreshController').RefreshController} RefreshController */
/** @typedef {import('@/app/types/Token').Token} Token */

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

/**
 * Props that TokenDetails passes to action item component.
 * @typedef {object} TokenDetailsActionProps
 * @property {Token} token - Token shown on the screen.
 * @property {ChainName} chainName - Chain token belongs to.
 * @property {string} tokenOwnerAccountAddress - Address of the account that holds the token.
 * @property {WalletAccount} currentAccount - Current account of the token chain.
 * Might be different from the token owner for which we show balance.
 * @property {NetworkProperties} networkProperties - Network properties of the token chain.
 */

/**
 * Wallet creation animation props.
 * @typedef {object} WalletCreationAnimationProps
 * @property {string[]} steps - List of all steps text.
 * @property {number} currentStep - Current step number (starting from 1).
 */

/**
 * Welcome view props.
 * @typedef {object} WelcomeViewProps
 * @property {function(): void} onCreateWalletPress - Callback when the create wallet button is pressed.
 * @property {function(): void} onImportWalletPress - Callback when the import wallet button is pressed.
 */

export {};
