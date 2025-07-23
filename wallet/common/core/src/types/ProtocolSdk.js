/** @typedef {import('../types/Account').PrivateAccount} PrivateAccount */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Transaction').Transaction} Transaction */
/** @typedef {import('../types/Transaction').SignedTransaction} SignedTransaction */
/** @typedef {import('../types/Transaction').CosignedTransaction} CosignedTransaction */

/**
 * @callback SignTransactionFn
 * @param {NetworkProperties} networkProperties - The network properties.
 * @param {Transaction} transaction - The transaction object.
 * @param {string} privateKey - The signer account private key.
 * @returns {SignedTransaction} The signed transaction.
 */

/**
 * @callback CosignTransactionFn
 * @param {Transaction} transaction - The transaction object.
 * @param {string} privateKey - The cosigner account private key.
 * @returns {CosignedTransaction} The cosigned transaction.
 */

/** 
 * @callback EncryptMessageFn
 * @param {string} messageText - The message text.
 * @param {string} recipientPublicKey - The recipient public key.
 * @param {string} privateKey - Current account private key.
 * @returns {string} The resulting payload HEX string.
 */

/**
 * @callback DecryptMessageFn
 * @param {string} encryptedMessageHex - The encrypted message HEX string.
 * @param {string} senderOrRecipientPublicKey - The sender or recipient public key.
 * @param {string} privateKey - Current account private key.
 * @returns {string} The resulting message text.
 */

/**
 * @callback CreatePrivateAccountFn
 * @param {string} privateKey - The private key.
 * @param {string} networkIdentifier - The network identifier.
 * @param {string} accountType - The account type.
 * @param {number} [index] - The account index.
 * @returns {PrivateAccount} The wallet storage account object.
 */

/**
 * @callback CreatePrivateKeysFromMnemonicFn
 * @param {string} mnemonic - The mnemonic phrase string used to generate the private keys.
 * @param {number[]} seedIndexes - An array of indexes to derive private keys from the mnemonic.
 * @param {string} networkIdentifier - The network identifier.
 * @returns {string[]} An array of private keys derived from the mnemonic.
 */

/** @typedef {{
 *   signTransaction: SignTransactionFn,
 *   cosignTransaction: CosignTransactionFn,
 *   encryptMessage: EncryptMessageFn,
 *   decryptMessage: DecryptMessageFn,
 *   createPrivateAccount: CreatePrivateAccountFn,
 *   createPrivateKeysFromMnemonic: CreatePrivateKeysFromMnemonicFn
 * }} ProtocolSdk
 */

export default {};
