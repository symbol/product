import { createContract, createEthereumJrpcProvider } from '../utils';

/** @typedef {import('../types/Token').TokenInfo} TokenInfo */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */

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

const ERC20_ABI = [
	'function decimals() view returns (uint8)',
	'function symbol() view returns (string)',
	'function name() view returns (string)'
];

const QUOTER_EXACT_INPUT_SINGLE_SIGNATURE =
	// eslint-disable-next-line max-len
	'function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut)';

const QUOTER_ABI = [QUOTER_EXACT_INPUT_SINGLE_SIGNATURE];

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
		const provider = createEthereumJrpcProvider(networkProperties);
		const nativeContract = createContract(nativeTokenId, ERC20_ABI, provider);
		const wrappedContract = createContract(wrappedTokenId, ERC20_ABI, provider);

		const [nativeName, nativeSymbol, nativeDecimals, wrappedName, wrappedSymbol, wrappedDecimals] = await Promise.all([
			nativeContract.name(),
			nativeContract.symbol(),
			nativeContract.decimals(),
			wrappedContract.name(),
			wrappedContract.symbol(),
			wrappedContract.decimals()
		]);

		return {
			nativeTokenInfo: {
				id: nativeTokenId.toLowerCase(),
				name: nativeName,
				ticker: nativeSymbol,
				divisibility: Number(nativeDecimals)
			},
			wrappedTokenInfo: {
				id: wrappedTokenId.toLowerCase(),
				name: wrappedName,
				ticker: wrappedSymbol,
				divisibility: Number(wrappedDecimals)
			}
		};
	};

	/**
	 * Calls quoteExactInputSingle on the Uniswap V3 Quoter contract to estimate swap output.
	 * Uses staticCall — no gas consumed, no transaction submitted.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} quoterAddress - Uniswap V3 Quoter contract address.
	 * @param {QuoteExactInputSingleParams} params - Quote parameters.
	 * @returns {Promise<string>} Estimated output amount in absolute units (as string).
	 */
	quoteExactInputSingle = async (networkProperties, quoterAddress, params) => {
		const provider = createEthereumJrpcProvider(networkProperties);
		const quoter = createContract(quoterAddress, QUOTER_ABI, provider);

		const amountOut = await quoter.quoteExactInputSingle.staticCall({
			tokenIn: params.tokenInId,
			tokenOut: params.tokenOutId,
			amountIn: BigInt(params.amountIn),
			fee: params.fee,
			sqrtPriceLimitX96: 0
		});

		return amountOut.toString();
	};
}
