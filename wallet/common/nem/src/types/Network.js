/**
 * @typedef {object} NetworkCurrency
 * @property {string} name - Mosaic name (e.g. 'nem.xem').
 * @property {string} mosaicId - Mosaic ID string (e.g. 'nem.xem').
 * @property {number} divisibility
 */

/**
 * @typedef {object} NetworkInfo
 * @property {string} nodeUrl
 * @property {string} wsUrl
 * @property {string} networkIdentifier - 'mainnet' | 'testnet'.
 * @property {string} generationHash
 * @property {number} chainHeight
 * @property {number} blockGenerationTargetTime - Seconds.
 * @property {number} epochAdjustment - Unix timestamp of NEM epoch in seconds.
 * @property {number} networkTime - NEM network time (ms since NEM epoch).
 * @property {RentalFees} rentalFees
 * @property {NetworkCurrency} networkCurrency
 */

/**
 * @typedef {NetworkInfo} NetworkProperties
 * NetworkInfo extended with runtime network properties used during transaction creation.
 */

/**
 * Rental / creation fees in absolute microXEM. These are paid to a dedicated fee sink, separately
 * from and in addition to the on-chain transaction fee (NEM NIS API Documentation fee table).
 * @typedef {object} RentalFees
 * @property {number} rootNamespaceFee - Root namespace provisioning rental fee (100 XEM).
 * @property {number} subNamespaceFee - Sub-namespace provisioning rental fee (10 XEM).
 * @property {number} mosaicDefinitionFee - Mosaic definition creation fee (10 XEM).
 */

/**
 * @typedef {object} TransactionFeeToken
 * @property {string} amount - The fee amount as a relative string.
 * @property {number} divisibility - The currency divisibility.
 * @property {string} id - The mosaic id.
 * @property {string} name - The mosaic name.
 */

/**
 * @typedef {object} TransactionFeeTier
 * @property {TransactionFeeToken} token - The fee token descriptor.
 */

/**
 * @typedef {object} TransactionFees
 * @property {TransactionFeeTier} fast - The fee for fastest inclusion.
 * @property {TransactionFeeTier} medium - The medium fee.
 * @property {TransactionFeeTier} slow - The minimum acceptable fee.
 */

export default {};
