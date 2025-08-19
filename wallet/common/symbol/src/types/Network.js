/**
 * @typedef {Object} TransactionFeeMultipliers
 * @property {string} averageFeeMultiplier - Average fee multiplier.
 * @property {string} medianFeeMultiplier - Median fee multiplier.
 * @property {string} highestFeeMultiplier - Highest fee multiplier.
 * @property {string} lowestFeeMultiplier - Lowest fee multiplier.
 * @property {string} minFeeMultiplier - Minimum fee multiplier.
 */

/**
 * @typedef {Object} NetworkCurrency
 * @property {string} name - Mosaic name.
 * @property {string} mosaicId - Mosaic identifier.
 * @property {number} divisibility - Mosaic divisibility.
 */

/**
 * @typedef {Object} NetworkInfo
 * @property {string} nodeUrl - API node URL.
 * @property {string} wsUrl - Websocket connection URL.
 * @property {string} networkIdentifier - Network identifier.
 * @property {string} generationHash - Network generation hash seed.
 * @property {number} chainHeight - Chain height at the time of the request.
 * @property {string} blockGenerationTargetTime - Block generation time in seconds.
 * @property {number} epochAdjustment - Epoch adjustment.
 * @property {TransactionFeeMultipliers} transactionFees - Transaction fee multipliers.
 * @property {NetworkCurrency} networkCurrency - Network currency mosaic.
 */

/**
 * @typedef {NetworkInfo} NetworkProperties
 * @property {string[]} nodeUrls - List of the network node URLs.
 */

/**
 * @typedef {Object} RentalFees
 * @property {number} mosaic - Mosaic rental fee.
 * @property {number} rootNamespacePerBlock - Root namespace rental fee per block.
 * @property {number} subNamespace - Sub namespace rental fee.
 */

/**
 * @typedef {Object} TransactionFees
 * @property {number} fast - The highest fee value.
 * @property {number} medium - The medium fee value.
 * @property {number} slow - The lowest fee value.
 */

export default {};
