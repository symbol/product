/** @typedef {import('wallet-common-core/src/types/Transaction').Transaction} Transaction */
/** @typedef {import('wallet-common-core/src/types/Transaction').TransactionFeeTiers} TransactionFeeTiers */
/** @typedef {import('wallet-common-core/src/types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */
/** @typedef {import('wallet-common-core/src/types/Transaction').TransactionMessage} TransactionMessage */
/** @typedef {import('wallet-common-core').TransactionBundle} TransactionBundle */
// eslint-disable-next-line max-len
/** @typedef {import('@/app/components/templates/TransactionScreenTemplate/types/ConfirmationDialog').ConfirmationDialogSection} TransactionConfirmationDialogSection */

/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Wallet').AddressBookModule} AddressBookModule */

/** @typedef {'transfer'|'aggregate'|'other'} TransactionKind */

/**
 * Resolved transaction type info that contains data for UI display.
 * @typedef {object} TransactionTypeInfo
 * @property {TransactionKind} kind - Generic transaction type.
 * @property {string} localeKey - Type localization key.
 * @property {string} icon - Transaction icon name.
 * @property {boolean} [hasLoseAccessRisk] - Dangerous transactions have this flag set to true.
 */

/**
 * Transaction graphic avatar type.
 * @typedef {'account' | 'token' | 'namespace' | 'lock'} TransactionGraphicAvatarType
 */

/**
 * Transaction graphic caption content type.
 * @typedef {'text' | 'icon'} TransactionGraphicCaptionType
 */

/**
 * Options for creating transaction graphic data.
 * @typedef {object} TransactionGraphicOptions
 * @property {WalletAccount[]} walletAccounts - Wallet accounts associated with the current network.
 * @property {AddressBookModule} [addressBook] - Address book module (if available).
 * @property {ChainName} chainName - Blockchain name (e.g. 'symbol', 'ethereum').
 * @property {NetworkIdentifier} networkIdentifier - Network identifier (e.g., 'mainnet', 'testnet').
 * @property {string} nativeCurrencyTicker - The ticker symbol for the native currency.
 * @property {string} nativeCurrencyTokenId - The token ID of the native currency.
 */

/**
 * Transaction graphic caption config (the text or icon below the arrow).
 * @typedef {object} TransactionGraphicArrowCaption
 * @property {TransactionGraphicCaptionType} type - Type of content to render.
 * @property {string} value - Text string to render or icon name.
 */

/**
 * Transaction graphic target config (that circle on the left side from the arrow).
 * @typedef {object} TransactionGraphicTarget
 * @property {TransactionGraphicAvatarType} type - Avatar type of the target.
 * @property {string} value - Account address for the account type, token id for the token type, label for the
 * namespace and lock types.
 */

/**
 * Transaction graphic content for specific transaction type.
 * @typedef {object} TransactionGraphicContent
 * @property {TransactionGraphicTarget} target - Target of the graphic.
 * @property {TransactionGraphicArrowCaption[]} arrowCaptions - Captions below the arrow.
 */

export {};
