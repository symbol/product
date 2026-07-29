/** @typedef {import('wallet-common-core/src/types/Bridge').BridgeEstimationError} BridgeEstimationError */

/**
 * @typedef {Object} UniswapExactInputQuote
 * @property {string} amountOut - Quoted output amount in absolute units.
 * @property {string} sqrtPriceX96After - Pool sqrt price after the simulated swap, as a decimal string.
 * @property {number} initializedTicksCrossed - Number of initialized ticks the simulated swap crossed.
 * @property {string} gasEstimate - Gas estimate of the swap reported by the quoter.
 */

/**
 * @typedef {Object} UniswapExactOutputQuote
 * @property {string} amountIn - Input amount in absolute units required to receive the requested output.
 * @property {string} sqrtPriceX96After - Pool sqrt price after the simulated swap, as a decimal string.
 */

/**
 * @typedef {Object} UniswapEstimation
 * @property {string|null} receiveAmount - Amount that will be received, in relative units. Null when the estimation failed.
 * @property {string|null} bridgeFee - Pool fee extracted from the output amount, in relative units. Null when the estimation failed.
 * @property {number|null} priceImpact - Price impact of the swap as a fraction in the [0, 1] range. Null when unknown
 * or the estimation failed.
 * @property {BridgeEstimationError|null} error - Error details if the estimation failed, null otherwise.
 */

export default {};
