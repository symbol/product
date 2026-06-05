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
 * @property {string} networkIdentifier - 'mainnet' | 'testnet'
 * @property {string} generationHash
 * @property {number} chainHeight
 * @property {number} blockGenerationTargetTime - Seconds.
 * @property {number} epochAdjustment - Unix timestamp of NEM epoch in seconds.
 * @property {number} networkTime - NEM network time (ms since NEM epoch).
 * @property {NemTransactionFees} transactionFees
 * @property {RentalFees} rentalFees
 * @property {NetworkCurrency} networkCurrency
 */

/**
 * NEM fee schedule in absolute microXEM. NEM1 fees are deterministic protocol constants
 * rather than node-derived per-byte multipliers, so NetworkService assembles this object
 * from the fee constants. Free-shape per chain — consumed only by the fee calculation
 * logic (utils/fee.js).
 * @typedef {object} NemTransactionFees
 * @property {number} baseFee - Base flat fee shared by several transaction types (0.15 XEM).
 * @property {number} perMosaicFee - Fee per non-native mosaic attached to a transfer.
 * @property {number} perMessageChunkFee - Fee per 32-byte message payload chunk.
 * @property {number} aggregateModificationFee - Multisig account modification fee.
 * @property {number} xemTierAmount - Whole-XEM amount per transfer fee tier.
 * @property {number} xemFeePerTier - Fee added per completed XEM tier.
 * @property {number} xemTransferFeeMax - Maximum XEM transfer fee component.
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
