/** @typedef {import('./Token').Token} Token */
/** @typedef {import('./Token').TokenInfo} TokenInfo */

/** 
 * @typedef {object} BridgeHelper
 * @property {function} createTransaction - Function to create bridge transaction
 * signature (options) => Promise<object>
 * @property {function} fetchTokenInfo - Function to fetch token by id
 * signature (networkProperties, tokenId) => Promise<TokenInfo>
 */

/**
 * @typedef {object} BridgeNetworkConfig
 * @property {string} blockchain - Blockchain name, e.g. 'symbol' or 'ethereum'
 * @property {string} bridgeAddress - Bridge account or contract address
 * @property {string} defaultNodeUrl - Default node URL
 * @property {string} explorerUrl - Explorer base URL
 * @property {string} network - Network name, e.g. 'mainnet'
 * @property {TokenInfo} tokenInfo - Token information
 */

/**
 * @typedef {object} BridgeConfig
 * @property {boolean} enabled - Whether bridge is enabled
 * @property {BridgeNetworkConfig} nativeNetwork - Configuration of the native network
 * @property {BridgeNetworkConfig} wrappedNetwork - Configuration of the wrapped network
 */

/**
 * @typedef {object} RequestTransaction
 * @property {string} signerAddress - Address of the transaction signer
 * @property {string} recipientAddress - Address of the transaction recipient
 * @property {string} hash - Transaction hash
 * @property {number} height - Block height
 * @property {number} timestamp - Transaction timestamp in milliseconds
 * @property {Token} [token] - Transferred token with amount
 */

/**
 * @typedef {object} PayoutTransaction
 * @property {string} recipientAddress - Address of the transaction recipient
 * @property {string} hash - Transaction hash
 * @property {number} height - Block height
 * @property {number} timestamp - Transaction timestamp in milliseconds
 * @property {Token} [token] - Transferred token with amount
 */

/**
 * @typedef {object} BridgeRequest
 * @property {string} type - Request type, either 'wrap' or 'unwrap'
 * @property {string} sourceChainName - Source chain name the request was made on
 * @property {string} targetChainName - Target chain name the payout will be made on
 * @property {TokenInfo} sourceTokenInfo - Source token information
 * @property {TokenInfo} targetTokenInfo - Payout token information
 * @property {number} payoutStatus - Payout status
 * @property {string} [payoutConversionRate] - Conversion rate applied to the payout amount
 * in relative units
 * @property {string} [payoutTotalFee] - Total fee deducted from the payout amount in relative units
 * @property {RequestTransaction} requestTransaction - Request transaction details
 * @property {PayoutTransaction} [payoutTransaction] - Payout transaction details
 */

/**
 * @typedef {object} BridgeError
 * @property {string} type - Request type, either 'wrap' or 'unwrap'
 * @property {string} errorMessage - Error message.
 * @property {RequestTransaction} requestTransaction - Transaction that caused the error.
 */

/**
 * @typedef {object} BridgeEstimation
 * @property {string} bridgeFee - Estimated total bridge fee paid for the bridge operation.
 * Amount is in target receiving currency in relative units.
 * @property {string} receiveAmount - Estimated amount to be received after conversion and fees deducted.
 * Amount is in target receiving currency in relative units.
 * @property {object|null} error - Error object if estimation failed, null otherwise.
 * If present, the estimation values should be ignored.
 * @property {boolean} [error.isAmountLow] - True if the provided amount is too low to perform
 * the bridge operation. Most likely the amount is lower than the fee.
 * @property {boolean} [error.isAmountHigh] - True if the provided amount is too high to perform
 * the bridge operation.
 */

export default {};
