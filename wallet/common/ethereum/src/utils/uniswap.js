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

/**
 * Calculates the price impact of an exact-input swap versus the pool mid price, excluding the pool
 * fee, so the reported figure never double-counts the fee shown separately in the swap summary.
 * amountIn and amountOut are absolute-unit strings: the mid price derived from sqrtPriceX96 is
 * denominated in raw token1 per raw token0, so only the raw pairing is dimensionless — relative
 * amounts would skew the ratio by the difference of the two token divisibilities.
 * Negative results (favorable rounding) clamp to 0.
 * @param {object} params - Parameters.
 * @param {string} params.amountIn - Swap input amount in absolute units.
 * @param {string} params.amountOut - Quoted output amount in absolute units.
 * @param {string} params.sqrtPriceX96 - Pool sqrt price before the swap, as a decimal string.
 * @param {boolean} params.zeroForOne - Swap direction flag.
 * @param {number} params.poolFee - Pool fee tier in hundredths of a bip (e.g. 3000 = 0.3%).
 * @returns {number|null} Price impact as a fraction in the [0, 1] range, or null when uncomputable.
 */
export const calculatePriceImpact = ({ amountIn, amountOut, sqrtPriceX96, zeroForOne, poolFee }) => {
	const Q192 = 2n ** 192n;
	const FEE_DENOMINATOR = 1_000_000n;
	// Scale factor for the BigInt ratio (BigInt division truncates): 1e6 gives 0.0001% resolution
	// while keeping the final Number() conversion within exact double range. Equality with
	// FEE_DENOMINATOR is coincidence — do not unify them.
	const PRECISION = 1_000_000n;

	const sqrtPrice = BigInt(sqrtPriceX96);
	const amountInBigInt = BigInt(amountIn);

	const expectedOut = zeroForOne
		? amountInBigInt * sqrtPrice * sqrtPrice / Q192
		: amountInBigInt * Q192 / (sqrtPrice * sqrtPrice);
	const expectedOutAfterFee = expectedOut * (FEE_DENOMINATOR - BigInt(poolFee)) / FEE_DENOMINATOR;

	if (expectedOutAfterFee === 0n)
		return null;

	const outputRatio = BigInt(amountOut) * PRECISION / expectedOutAfterFee;
	const clampedRatio = outputRatio > PRECISION ? PRECISION : outputRatio;

	return Number(PRECISION - clampedRatio) / Number(PRECISION);
};
