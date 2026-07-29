import { TransactionType } from '../constants';
import { applySaturationHaircut, calculatePriceImpact, isSaturatedQuote, isZeroForOne, normalizeAddress } from '../utils';
import { TransactionBundle, absoluteToRelativeAmount, constants, relativeToAbsoluteAmount } from 'wallet-common-core';

const DEFAULT_TRANSACTION_DEADLINE_SECONDS = 600;

const { BridgeEstimationErrorCode } = constants;

/** @typedef {import('wallet-common-core').WalletController} WalletController */
/** @typedef {import('../types/Token').TokenInfo} TokenInfo */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Uniswap').UniswapEstimation} UniswapEstimation */
/** @typedef {import('../types/Uniswap').PoolSlot0} PoolSlot0 */
/** @typedef {import('../api/UniswapService').UniswapService} UniswapService */
/** @typedef {import('../api/TransactionService').TransactionService} TransactionService */
/** @typedef {import('wallet-common-core/src/types/Network').NetworkMap<UniswapNetworkConfig>} UniswapNetworkConfigMap */

/**
 * @typedef {Object} UniswapNetworkConfig
 * @property {string} nativeTokenId - Token identifier or token contract address.
 * @property {string} wrappedTokenId - Token identifier or token contract address.
 * @property {string} wethTokenId - WETH token contract address.
 * @property {string} quoterAddress - Uniswap V3 Quoter contract address.
 * @property {string} swapRouterAddress - Uniswap V3 SwapRouter contract address.
 * @property {string} poolAddress - Uniswap V3 pool contract address. Empty when the pool is not deployed yet.
 * @property {number} poolFee - Pool fee tier in hundredths of a bip (e.g. 3000 = 0.3%).
 */

const SwapMode = {
	WRAP: 'wrap',
	UNWRAP: 'unwrap'
};

export class UniswapPairManager {
	/** @type {WalletController} */
	#walletController;

	/** @type {UniswapService} */
	#uniswapApi;

	/** @type {TransactionService} */
	#transactionApi;

	/** @type {UniswapNetworkConfigMap} */
	#configs;

	/** @type {string} */
	#mode;

	/** @type {TokenInfo|null} */
	#nativeTokenInfo;

	/** @type {TokenInfo|null} */
	#wrappedTokenInfo;

	/**
	 * Create UniswapPairManager instance.
	 * @param {object} options - Options.
	 * @param {string} options.mode - Fixed swap direction: 'wrap' or 'unwrap'.
	 * @param {WalletController} options.walletController - Ethereum wallet controller instance.
	 * @param {UniswapService} options.uniswapApi - Uniswap API service for on-chain quote and token info calls.
	 * @param {TransactionService} options.transactionApi - Transaction API service for nonce fetching.
	 * @param {UniswapNetworkConfigMap} options.configs - Per-network Uniswap configuration map (keyed by network identifier).
	 */
	constructor(options) {
		this.#walletController = options.walletController;
		this.#uniswapApi = options.uniswapApi;
		this.#transactionApi = options.transactionApi;
		this.#configs = options.configs;
		this.#nativeTokenInfo = null;
		this.#wrappedTokenInfo = null;

		if (options.mode !== SwapMode.WRAP && options.mode !== SwapMode.UNWRAP)
			throw new Error(`Invalid swap mode: ${options.mode}. Must be 'wrap' or 'unwrap'`);

		this.#mode = options.mode;
	}

	get #networkConfig() {
		return this.#configs[this.#walletController.networkIdentifier];
	}

	/**
	 * Get the fixed swap direction.
	 * @returns {string} - 'wrap' or 'unwrap'
	 */
	get mode() {
		return this.#mode;
	}

	/**
	 * Uniswap swaps are not tracked in on-chain history by this manager.
	 * @returns {boolean}
	 */
	get hasHistory() {
		return false;
	}

	/**
	 * Whether the manager is ready to create transactions.
	 * @returns {boolean}
	 */
	get isReady() {
		return this.#walletController.isWalletReady && this.#nativeTokenInfo !== null;
	}

	/**
	 * A Uniswap pool has no operator switch, so this manager is always enabled.
	 * @returns {boolean}
	 */
	get isEnabled() {
		return true;
	}

	/**
	 * Token info for the native side of the swap (tokenIn when mode=wrap).
	 * Note: both tokens are ERC20 on Ethereum — "native" here is a directional label
	 * consistent with BridgePairManager's interface, not native-chain currency.
	 * @returns {TokenInfo|null}
	 */
	get nativeTokenInfo() {
		return this.#nativeTokenInfo;
	}

	/**
	 * Token info for the wrapped side of the swap (tokenOut when mode=wrap).
	 * @returns {TokenInfo|null}
	 */
	get wrappedTokenInfo() {
		return this.#wrappedTokenInfo;
	}

	/**
	 * Token info for the source side of the swap (tokenIn).
	 * @returns {TokenInfo|null}
	 */
	get sourceTokenInfo() {
		return this.#mode === SwapMode.WRAP ? this.#nativeTokenInfo : this.#wrappedTokenInfo;
	}

	/**
	 * Token info for the target side of the swap (tokenOut).
	 * @returns {TokenInfo|null}
	 */
	get targetTokenInfo() {
		return this.#mode === SwapMode.WRAP ? this.#wrappedTokenInfo : this.#nativeTokenInfo;
	}

	/**
	 * The single Ethereum wallet controller, exposed as nativeWalletController
	 * for interface consistency with BridgePairManager.
	 * @returns {WalletController}
	 */
	get nativeWalletController() {
		return this.#walletController;
	}

	/**
	 * The single Ethereum wallet controller, exposed as wrappedWalletController
	 * for interface consistency with BridgePairManager.
	 * @returns {WalletController}
	 */
	get wrappedWalletController() {
		return this.#walletController;
	}

	/**
	 * Wallet controller for the source side of the swap.
	 * Both sides share the same controller for Uniswap (single-chain swap).
	 * @returns {WalletController}
	 */
	get sourceWalletController() {
		return this.#walletController;
	}

	/**
	 * Wallet controller for the target side of the swap.
	 * Both sides share the same controller for Uniswap (single-chain swap).
	 * @returns {WalletController}
	 */
	get targetWalletController() {
		return this.#walletController;
	}

	/**
	 * Fetch ERC20 token info for both sides of the swap pool from the chain.
	 * @returns {Promise<void>}
	 */
	load = async () => {
		const { networkProperties } = this.#walletController;
		const { nativeTokenId, wrappedTokenId } = this.#networkConfig;
		const { nativeTokenInfo, wrappedTokenInfo } = await this.#uniswapApi.fetchPoolTokenInfos(
			networkProperties,
			nativeTokenId.toLowerCase(),
			wrappedTokenId.toLowerCase()
		);

		this.#nativeTokenInfo = nativeTokenInfo;
		this.#wrappedTokenInfo = wrappedTokenInfo;
	};

	/**
	 * Uniswap does not track on-chain history. Returns an empty array.
	 * @returns {Promise<Array>}
	 */
	fetchRecentHistory = async () => [];

	/**
	 * Estimate how much of the output token will be received for a given input amount
	 * using the Uniswap V3 Quoter contract (on-chain, no gas consumed).
	 * Returns an insufficient-liquidity error when the pool cannot absorb the input amount.
	 * @param {string} amount - Input amount in relative units.
	 * @returns {Promise<UniswapEstimation>}
	 */
	estimateRequest = async amount => {
		if (!this.#nativeTokenInfo)
			throw new Error('Failed to estimate Uniswap swap. Manager not loaded');

		const { sourceTokenInfo, targetTokenInfo } = this;

		const { networkProperties } = this.#walletController;
		const amountInAbsolute = relativeToAbsoluteAmount(amount, sourceTokenInfo.divisibility);
		const { networkCurrency } = networkProperties;

		if (BigInt(amountInAbsolute) === 0n)
			return this.#createFailedEstimation(BridgeEstimationErrorCode.AMOUNT_LOW);

		const { wethTokenId, quoterAddress, poolFee } = this.#networkConfig;
		const wethId = wethTokenId.toLowerCase();
		const tokenInId = sourceTokenInfo.id === networkCurrency.id ? wethId : sourceTokenInfo.id;
		const tokenOutId = targetTokenInfo.id === networkCurrency.id ? wethId : targetTokenInfo.id;

		// Started before the quote so both requests run in parallel; it never rejects.
		const slot0Promise = this.#fetchPoolSlot0Safe(networkProperties);

		let quote;
		try {
			quote = await this.#uniswapApi.quoteExactInputSingle(networkProperties, normalizeAddress(quoterAddress), {
				tokenInId,
				tokenOutId,
				amountIn: amountInAbsolute,
				fee: poolFee
			});
		} catch (error) {
			if (!this.#isQuoterRevert(error))
				throw error;

			return this.#createFailedEstimation(BridgeEstimationErrorCode.INSUFFICIENT_LIQUIDITY);
		}

		const zeroForOne = isZeroForOne(tokenInId, tokenOutId);

		if (isSaturatedQuote(quote.sqrtPriceX96After, zeroForOne)) {
			const maxAmount = await this.#tryEstimateMaxSwappableAmount({ cappedAmountOut: quote.amountOut, tokenInId, tokenOutId });

			return this.#createFailedEstimation(
				BridgeEstimationErrorCode.INSUFFICIENT_LIQUIDITY,
				maxAmount ? { maxAmount, ticker: this.sourceTokenInfo.ticker } : undefined
			);
		}

		const slot0 = await slot0Promise;
		const priceImpact = slot0
			? calculatePriceImpact({
				amountIn: amountInAbsolute,
				amountOut: quote.amountOut,
				sqrtPriceX96: slot0.sqrtPriceX96,
				zeroForOne,
				poolFee
			})
			: null;

		const feeAbsolute = BigInt(quote.amountOut) * BigInt(poolFee) / 1_000_000n;

		return {
			receiveAmount: absoluteToRelativeAmount(quote.amountOut, targetTokenInfo.divisibility),
			bridgeFee: absoluteToRelativeAmount(String(feeAbsolute), targetTokenInfo.divisibility),
			priceImpact,
			error: null
		};
	};

	/**
	 * Fetches the pool's current price state, resolving to null on any failure so that a missing
	 * reference price degrades the estimation to an unknown price impact instead of failing it.
	 * Skipped when no pool address is configured for the network.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @returns {Promise<PoolSlot0|null>} Pool price state, or null when unavailable.
	 */
	#fetchPoolSlot0Safe = async networkProperties => {
		const { poolAddress } = this.#networkConfig;

		if (!poolAddress)
			return null;

		try {
			return await this.#uniswapApi.fetchPoolSlot0(networkProperties, normalizeAddress(poolAddress));
		} catch {
			return null;
		}
	};

	/**
	 * Checks whether an error is a quoter contract revert rather than an infrastructure failure.
	 * The quoter reverts when the swap cannot be simulated at all (e.g. it starts inside
	 * a zero-liquidity region), which is an insufficient-liquidity condition, not a network error.
	 * @param {Error} error - Error thrown by the quoter call.
	 * @returns {boolean} True when the error is a contract revert.
	 */
	#isQuoterRevert = error => error.code === 'CALL_EXCEPTION';

	/**
	 * Estimates the maximum input amount the pool can currently absorb by requesting the input
	 * needed to buy the saturated quote's output. Failures degrade the error message instead of
	 * breaking the estimation, so any error resolves to undefined.
	 * @param {object} options - Options.
	 * @param {string} options.cappedAmountOut - Saturated quote output in absolute units.
	 * @param {string} options.tokenInId - Input token contract address used for the quote.
	 * @param {string} options.tokenOutId - Output token contract address used for the quote.
	 * @returns {Promise<string|undefined>} Maximum swappable amount in relative units, or undefined.
	 */
	#tryEstimateMaxSwappableAmount = async ({ cappedAmountOut, tokenInId, tokenOutId }) => {
		try {
			const { networkProperties } = this.#walletController;
			const { quoterAddress, poolFee } = this.#networkConfig;
			const quote = await this.#uniswapApi.quoteExactOutputSingle(networkProperties, normalizeAddress(quoterAddress), {
				tokenInId,
				tokenOutId,
				amountOut: applySaturationHaircut(cappedAmountOut),
				fee: poolFee
			});

			return absoluteToRelativeAmount(quote.amountIn, this.sourceTokenInfo.divisibility);
		} catch {
			return undefined;
		}
	};

	/**
	 * Creates a failed estimation carrying the given error code.
	 * @param {string} code - One of BridgeEstimationErrorCode.
	 * @param {Object.<string, string>} [params] - Optional parameters for the user-facing error message.
	 * @returns {UniswapEstimation} Estimation with the error set and no amounts.
	 */
	#createFailedEstimation = (code, params) => ({
		receiveAmount: null,
		bridgeFee: null,
		priceImpact: null,
		error: {
			code,
			...(params && { params })
		}
	});

	/**
	 * Create a Uniswap V3 exactInputSingle swap transaction.
	 * @param {object} options - Options.
	 * @param {string} options.recipientAddress - Recipient address.
	 * @param {string} options.amount - Input amount in relative units.
	 * @param {string} [options.amountOutMinimum='0'] - Minimum output amount in relative units (slippage protection).
	 * @param {object} [options.fee] - EIP-1559 gas fee object.
	 * @param {number} [options.deadlineSeconds] - Transaction validity window in seconds from now.
	 * @returns {Promise<TransactionBundle>}
	 */
	createTransaction = async (options = {}) => {
		const {
			recipientAddress,
			amount,
			amountOutMinimum = '0',
			fee,
			deadlineSeconds = DEFAULT_TRANSACTION_DEADLINE_SECONDS
		} = options;

		if (!this.#nativeTokenInfo)
			throw new Error('Failed to create Uniswap transaction. Manager not loaded');

		const { currentAccount, networkProperties } = this.#walletController;

		if (!currentAccount)
			throw new Error('Failed to create Uniswap transaction. No current account selected');

		const tokenIn = this.sourceTokenInfo;
		const tokenOut = this.targetTokenInfo;

		const nonce = await this.#transactionApi.fetchTransactionNonce(networkProperties, currentAccount.address);

		const { wethTokenId, swapRouterAddress, poolFee } = this.#networkConfig;
		const normalizedRouterAddress = normalizeAddress(swapRouterAddress);

		const approveTransaction = {
			type: TransactionType.ERC_20_APPROVE,
			signerPublicKey: currentAccount.publicKey,
			signerAddress: normalizeAddress(currentAccount.address),
			tokenId: tokenIn.id,
			spenderAddress: normalizedRouterAddress,
			amount,
			divisibility: tokenIn.divisibility,
			fee
		};

		const transaction = {
			type: TransactionType.UNISWAP_SWAP,
			signerPublicKey: currentAccount.publicKey,
			signerAddress: normalizeAddress(currentAccount.address),
			recipientAddress: normalizeAddress(recipientAddress),
			routerAddress: normalizedRouterAddress,
			sourceToken: {
				...tokenIn,
				amount
			},
			targetToken: {
				...tokenOut,
				amount: amountOutMinimum
			},
			wethTokenId: wethTokenId.toLowerCase(),
			poolFee,
			deadline: Math.floor(Date.now() / 1000) + deadlineSeconds,
			sqrtPriceLimitX96: 0,
			fee
		};

		if (tokenIn.id === networkProperties.networkCurrency.id) {
			transaction.nonce = nonce;
			return new TransactionBundle([transaction]);
		}

		approveTransaction.nonce = nonce;
		transaction.nonce = nonce + 1;

		return new TransactionBundle([approveTransaction, transaction]);
	};
}
