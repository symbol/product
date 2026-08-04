import { TokenService } from './TokenService';
import { createContract, createEthereumJrpcProvider } from '../utils';

/** @typedef {import('../types/Token').TokenInfo} TokenInfo */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Uniswap').UniswapExactInputQuote} UniswapExactInputQuote */
/** @typedef {import('../types/Uniswap').UniswapExactOutputQuote} UniswapExactOutputQuote */
/** @typedef {import('../types/Uniswap').PoolSlot0} PoolSlot0 */

/**
 * @typedef {Object} UniswapPoolTokenInfos
 * @property {TokenInfo} nativeTokenInfo - Token info for the native (tokenIn) side of the pool.
 * @property {TokenInfo} wrappedTokenInfo - Token info for the wrapped (tokenOut) side of the pool.
 */

/**
 * @typedef {Object} QuoteExactInputSingleParams
 * @property {string} tokenInId - Address of the input token.
 * @property {string} tokenOutId - Address of the output token.
 * @property {string} amountIn - Input amount in absolute units (as string).
 * @property {number} fee - Pool fee tier (e.g. 3000 = 0.3%).
 */

/**
 * @typedef {Object} QuoteExactOutputSingleParams
 * @property {string} tokenInId - Address of the input token.
 * @property {string} tokenOutId - Address of the output token.
 * @property {string} amountOut - Requested output amount in absolute units (as string).
 * @property {number} fee - Pool fee tier (e.g. 3000 = 0.3%).
 */

const QUOTER_EXACT_INPUT_SINGLE_SIGNATURE =
	// eslint-disable-next-line max-len
	'function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)';

const QUOTER_EXACT_OUTPUT_SINGLE_SIGNATURE =
	// eslint-disable-next-line max-len
	'function quoteExactOutputSingle(tuple(address tokenIn, address tokenOut, uint256 amount, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountIn, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)';

const QUOTER_ABI = [QUOTER_EXACT_INPUT_SINGLE_SIGNATURE, QUOTER_EXACT_OUTPUT_SINGLE_SIGNATURE];

const POOL_SLOT0_SIGNATURE =
	// eslint-disable-next-line max-len
	'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)';

const POOL_ABI = [POOL_SLOT0_SIGNATURE];

export class UniswapService {
	constructor() {}

	/**
	 * Fetches ERC20 token info for both sides of a Uniswap pool in a single batched call.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} nativeTokenId - Contract address of the native (tokenIn) token.
	 * @param {string} wrappedTokenId - Contract address of the wrapped (tokenOut) token.
	 * @returns {Promise<UniswapPoolTokenInfos>} Token info for both pool sides.
	 */
	fetchPoolTokenInfos = async (networkProperties, nativeTokenId, wrappedTokenId) => {
		const tokenService = new TokenService();
		const tokenInfos = await tokenService.fetchTokenInfos(networkProperties, [nativeTokenId, wrappedTokenId]);

		return {
			nativeTokenInfo: tokenInfos[nativeTokenId.toLowerCase()],
			wrappedTokenInfo: tokenInfos[wrappedTokenId.toLowerCase()]
		};
	};

	/**
	 * Calls quoteExactInputSingle on the Uniswap V3 Quoter contract to estimate swap output.
	 * Uses staticCall — no gas consumed, no transaction submitted.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} quoterAddress - Uniswap V3 Quoter contract address.
	 * @param {QuoteExactInputSingleParams} params - Quote parameters.
	 * @returns {Promise<UniswapExactInputQuote>} Quoted output amount and post-swap pool state.
	 */
	quoteExactInputSingle = async (networkProperties, quoterAddress, params) => {
		const provider = createEthereumJrpcProvider(networkProperties);
		const quoter = createContract(quoterAddress, QUOTER_ABI, provider);

		const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] =
			await quoter.quoteExactInputSingle.staticCall({
				tokenIn: params.tokenInId,
				tokenOut: params.tokenOutId,
				amountIn: BigInt(params.amountIn),
				fee: params.fee,
				sqrtPriceLimitX96: 0
			});

		return {
			amountOut: amountOut.toString(),
			sqrtPriceX96After: sqrtPriceX96After.toString(),
			initializedTicksCrossed: Number(initializedTicksCrossed),
			gasEstimate: gasEstimate.toString()
		};
	};

	/**
	 * Calls quoteExactOutputSingle on the Uniswap V3 Quoter contract to estimate the input amount
	 * required to receive a given output. Uses staticCall — no gas consumed, no transaction submitted.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} quoterAddress - Uniswap V3 Quoter contract address.
	 * @param {QuoteExactOutputSingleParams} params - Quote parameters.
	 * @returns {Promise<UniswapExactOutputQuote>} Required input amount and post-swap pool state.
	 */
	quoteExactOutputSingle = async (networkProperties, quoterAddress, params) => {
		const provider = createEthereumJrpcProvider(networkProperties);
		const quoter = createContract(quoterAddress, QUOTER_ABI, provider);

		const [amountIn, sqrtPriceX96After] = await quoter.quoteExactOutputSingle.staticCall({
			tokenIn: params.tokenInId,
			tokenOut: params.tokenOutId,
			amount: BigInt(params.amountOut),
			fee: params.fee,
			sqrtPriceLimitX96: 0
		});

		return {
			amountIn: amountIn.toString(),
			sqrtPriceX96After: sqrtPriceX96After.toString()
		};
	};

	/**
	 * Fetches the current price state from a Uniswap V3 pool contract.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} poolAddress - Uniswap V3 pool contract address.
	 * @returns {Promise<PoolSlot0>} Current pool sqrt price and tick.
	 */
	fetchPoolSlot0 = async (networkProperties, poolAddress) => {
		const provider = createEthereumJrpcProvider(networkProperties);
		const pool = createContract(poolAddress, POOL_ABI, provider);

		const [sqrtPriceX96, tick] = await pool.slot0();

		return {
			sqrtPriceX96: sqrtPriceX96.toString(),
			tick: Number(tick)
		};
	};
}
