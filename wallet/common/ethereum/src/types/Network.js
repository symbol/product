/**
 * @typedef {Object} TransactionFeeMultiplier
 * @property {string} maxFeePerGas - The maximum fee per gas for the transaction. Relative amount string in Ethers.
 * @property {string} maxPriorityFeePerGas - The maximum priority fee per gas for the transaction. Relative amount string in Ethers.
 */

/**
 * @typedef {Object} TransactionFeeMultipliers
 * @property {TransactionFeeMultiplier} fast - Highest fee multiplier.
 * @property {TransactionFeeMultiplier} medium - Median fee multiplier.
 * @property {TransactionFeeMultiplier} slow - Lowest fee multiplier.
 */

/**
 * @typedef {Object} NetworkCurrency
 * @property {string} name - Token symbol ('ETH').
 * @property {string} id - Token identifier ('ETH').
 * @property {number} divisibility - Token divisibility (18).
 */

/**
 * @typedef {Object} NetworkInfo
 * @property {string} nodeUrl - API node URL.
 * @property {string} wsUrl - Websocket connection URL.
 * @property {string} networkIdentifier - Network identifier.
 * @property {number} chainHeight - Chain height at the time of the request.
 * @property {TransactionFeeMultipliers} transactionFees - Transaction fee multipliers.
 * @property {NetworkCurrency} networkCurrency - Network currency token.
 */

/**
 * @typedef {NetworkInfo} NetworkProperties
 * @property {string[]} nodeUrls - List of the network node URLs.
 */


export default {};
