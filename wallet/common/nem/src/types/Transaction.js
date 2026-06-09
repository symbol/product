/** @typedef {import('./Mosaic').Mosaic} Mosaic */

/**
 * @typedef {object} Message
 * @property {string} type - Common message kind: a wallet-common-core MessageType value ('plain' | 'encrypted' | 'raw'). UI reads this.
 * @property {string|null} text - Decoded UTF-8 text; null for an encrypted (or non-text) message until decrypted.
 * @property {string} payload - Raw on-chain message payload hex (no type marker); round-trippable; passed to decryptMessage.
 * @property {object} native - Chain-specific message metadata, opaque to the UI.
 * @property {number} native.type - The NEM protocol message-type code (1=plain, 2=encrypted).
 */

/**
 * @typedef {object} Deadline
 * @property {number} timestamp - UI-ready expiry time (Unix ms).
 * @property {{ timestamp: number, deadline: number }} adjusted - SDK-ready NEM times (seconds since the NEM
 * epoch): the creation `timestamp` and the expiry `deadline`.
 */

/**
 * @typedef {object} MultisigModification
 * @property {number} modificationType - MultisigAccountModificationType code (1=add, 2=delete).
 * @property {string} cosignatoryPublicKey - Public key of the cosignatory to add or remove.
 */

/**
 * @typedef {object} MosaicLevy
 * @property {number} type - MosaicTransferFeeType code (1=absolute, 2=percentile).
 * @property {string} recipientAddress - Address that receives the levy.
 * @property {string} mosaicId - Levy mosaic id ('namespace.name').
 * @property {number|string} fee - Levy fee in smallest units.
 */

/**
 * @typedef {object} MosaicProperties
 * @property {number} [divisibility] - Number of decimal places.
 * @property {number} [initialSupply] - Initial supply in whole units.
 * @property {boolean} [supplyMutable] - Whether the supply can change later.
 * @property {boolean} [transferable] - Whether the mosaic can be transferred between non-owners.
 */

/**
 * @typedef {object} MosaicDefinition
 * @property {string} id - Mosaic id ('namespace.name').
 * @property {string} [ownerPublicKey] - Owner public key (defaults to the transaction signer).
 * @property {string} [description] - Human-readable description.
 * @property {MosaicProperties} [properties] - Mosaic properties.
 * @property {MosaicLevy|null} [levy] - Optional transfer levy.
 */

/**
 * @typedef {object} Transaction
 * @property {number} type - TransactionType value.
 * @property {string|null} hash
 * @property {number|null} timestamp - Transaction date/time from the history API (Unix ms).
 * @property {Deadline|null} [deadline]
 * @property {number|null} height
 * @property {number|null} fee - Relative fee in native currency.
 * @property {string|null} signerAddress
 * @property {string|null} signerPublicKey
 * @property {string|null} [recipientAddress]
 * @property {number} [amount] - Signed amount (positive=incoming, negative=outgoing).
 * @property {Mosaic[]} [mosaics]
 * @property {Message|null} [message]
 * @property {Transaction|null} [innerTransaction]
 * @property {Transaction[]} [innerTransactions]
 * @property {Array} [cosignatures]
 * @property {number} [linkAction] - Importance transfer: LinkAction code (1=activate, 2=deactivate).
 * @property {string} [remotePublicKey] - Importance transfer: the remote (delegated) account public key.
 * @property {string} [remoteAccountAddress] - Importance transfer: address derived from the remote account public key.
 * @property {MultisigModification[]} [modifications] - Multisig account modification: cosignatory changes.
 * @property {number} [minApprovalDelta] - Multisig account modification (v2): change to the minimum cosignatories.
 * @property {string} [otherTransactionHash] - Cosignature: hash of the cosigned inner transaction.
 * @property {string} [multisigAccountAddress] - Cosignature: address of the multisig account.
 * @property {string} [namespaceName] - Namespace registration: the new namespace part.
 * @property {string|null} [parentName] - Namespace registration: parent namespace, or null for a root namespace.
 * @property {string} [namespaceId] - Namespace registration: fully-qualified namespace id ('parent.name' or 'name').
 * @property {string} [rentalFeeSink] - Namespace / mosaic definition: address of the rental or creation fee sink.
 * @property {object} [rentalFee] - Namespace / mosaic definition: rental or creation fee token, paid to the fee sink.
 * @property {MosaicDefinition} [mosaicDefinition] - Mosaic definition: the mosaic being defined.
 * @property {string} [mosaicId] - Mosaic supply change: the mosaic id ('namespace.name').
 * @property {number} [action] - Mosaic supply change: MosaicSupplyChangeAction code (1=increase, 2=decrease).
 * @property {number|string} [delta] - Mosaic supply change: supply delta in smallest units.
 */

/**
 * @typedef {object} SignedTransaction
 * @property {string} hash - Transaction hash (hex).
 * @property {{ data: string, signature: string }} dto - Body announced to NEM /transaction/announce.
 */

/**
 * @typedef {object} CosignedTransaction
 * @property {string} hash
 * @property {string} signerPublicKey
 * @property {{ data: string, signature: string }} dto - Body announced to NEM /transaction/announce/cosignature.
 */

export default {};
