// Uniswap V3 swap price boundaries: the TickMath sqrt price limits shifted by one, which the
// periphery substitutes when a swap is submitted without an explicit price limit.
export const MIN_SQRT_PRICE_LIMIT_X96 = 4295128740n;
export const MAX_SQRT_PRICE_LIMIT_X96 = 1461446703485210103287273052203988822378723970341n;

const SATURATION_HAIRCUT_NUMERATOR = 9_999n;
const SATURATION_HAIRCUT_DENOMINATOR = 10_000n;

/**
 * Determines the swap direction flag used by Uniswap V3 pools. A pool orders its tokens by
 * address, and a swap is "zero for one" when the input token is the lower-addressed one.
 * @param {string} tokenInId - Input token contract address.
 * @param {string} tokenOutId - Output token contract address.
 * @returns {boolean} True when the input token is the pool's token0.
 */
export const isZeroForOne = (tokenInId, tokenOutId) => {
	return tokenInId.toLowerCase() < tokenOutId.toLowerCase();
};

/**
 * Checks whether a quote exhausted the pool's liquidity. The swap simulation stops exactly at the
 * directional price boundary when it runs out of liquidity before consuming the input, so strict
 * equality with the boundary is a precise saturation signal.
 * @param {string} sqrtPriceX96After - Pool sqrt price after the quoted swap, as a decimal string.
 * @param {boolean} zeroForOne - Swap direction flag.
 * @returns {boolean} True when the quoted swap could not consume the whole input.
 */
export const isSaturatedQuote = (sqrtPriceX96After, zeroForOne) => {
	const boundary = zeroForOne ? MIN_SQRT_PRICE_LIMIT_X96 : MAX_SQRT_PRICE_LIMIT_X96;

	return BigInt(sqrtPriceX96After) === boundary;
};

/**
 * Slightly reduces a saturated quote output before requesting the exact-output counter-quote.
 * Requesting the full capped output can revert on opposite-direction rounding.
 * @param {string} amount - Amount in absolute units.
 * @returns {string} Reduced amount in absolute units.
 */
export const applySaturationHaircut = amount => {
	const reducedAmount = BigInt(amount) * SATURATION_HAIRCUT_NUMERATOR / SATURATION_HAIRCUT_DENOMINATOR;

	return reducedAmount.toString();
};
