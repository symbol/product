import { TransactionType } from '../constants';
import { normalizeAddress } from '../utils';
import { TransactionBundle, absoluteToRelativeAmount, relativeToAbsoluteAmount } from 'wallet-common-core';

const DEFAULT_TRANSACTION_DEADLINE_SECONDS = 600;

/** @typedef {import('../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../types/Token').TokenInfo} TokenInfo */
/** @typedef {import('../api/UniswapService').UniswapService} UniswapService */
/** @typedef {import('../api/TransactionService').TransactionService} TransactionService */

/**
 * @typedef {Object} UniswapEstimation
 * @property {string} receiveAmount - Amount that will be received, in relative units.
 * @property {string} bridgeFee - Pool fee extracted from the output amount, in relative units.
 * @property {object|null} error - Error info if estimation failed.
 */

const SwapMode = {
	WRAP: 'wrap',
	UNWRAP: 'unwrap'
};

export class UniswapPairManager {
	/** @type {import('wallet-common-core').WalletController} */
	#walletController;

	/** @type {UniswapService} */
	#uniswapApi;

	/** @type {TransactionService} */
	#transactionApi;

	/** @type {string} */
	#nativeTokenId;

	/** @type {string} */
	#wrappedTokenId;

	/** @type {string} */
	#quoterAddress;

	/** @type {string} */
	#swapRouterAddress;

	/** @type {number} */
	#poolFee;

	/** @type {string} */
	#id;

	/** @type {string} */
	#mode;

	/** @type {TokenInfo|null} */
	#nativeTokenInfo;

	/** @type {TokenInfo|null} */
	#wrappedTokenInfo;

	/**
	 * Create UniswapPairManager instance.
	 * @param {object} options - Options.
	 * @param {string} options.id - Custom provided ID to identify the Uniswap pair manager.
	 * @param {string} options.mode - Fixed swap direction: 'wrap' or 'unwrap'.
	 * @param {import('wallet-common-core').WalletController} options.walletController - Ethereum wallet controller instance.
	 * @param {UniswapService} options.uniswapApi - Uniswap API service for on-chain quote and token info calls.
	 * @param {TransactionService} options.transactionApi - Transaction API service for nonce fetching.
	 * @param {string} options.nativeTokenId - ERC20 contract address of the "native" token (tokenIn for WRAP mode, e.g. WETH).
	 * @param {string} options.wrappedTokenId - ERC20 contract address of the "wrapped" token (tokenOut for WRAP mode, e.g. WXYM).
	 * @param {string} options.quoterAddress - Uniswap V3 Quoter contract address.
	 * @param {string} options.swapRouterAddress - Uniswap V3 SwapRouter contract address.
	 * @param {number} options.poolFee - Pool fee tier in hundredths of a bip (e.g. 3000 = 0.3%).
	 */
	constructor(options) {
		this.#walletController = options.walletController;
		this.#uniswapApi = options.uniswapApi;
		this.#transactionApi = options.transactionApi;
		this.#nativeTokenId = options.nativeTokenId.toLowerCase();
		this.#wrappedTokenId = options.wrappedTokenId.toLowerCase();
		this.#quoterAddress = normalizeAddress(options.quoterAddress);
		this.#swapRouterAddress = normalizeAddress(options.swapRouterAddress);
		this.#poolFee = options.poolFee;
		this.#id = options.id ?? `uniswap-${options.nativeTokenId}-${options.wrappedTokenId}`;
		this.#nativeTokenInfo = null;
		this.#wrappedTokenInfo = null;

		if (options.mode !== SwapMode.WRAP && options.mode !== SwapMode.UNWRAP)
			throw new Error(`Invalid swap mode: ${options.mode}. Must be 'wrap' or 'unwrap'`);

		this.#mode = options.mode;
	}

	/**
	 * Get the Uniswap pair manager ID.
	 * @returns {string}
	 */
	get id() {
		return this.#id;
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
	 * The single Ethereum wallet controller, exposed as nativeWalletController
	 * for interface consistency with BridgePairManager.
	 * @returns {import('wallet-common-core').WalletController}
	 */
	get nativeWalletController() {
		return this.#walletController;
	}

	/**
	 * The single Ethereum wallet controller, exposed as wrappedWalletController
	 * for interface consistency with BridgePairManager.
	 * @returns {import('wallet-common-core').WalletController}
	 */
	get wrappedWalletController() {
		return this.#walletController;
	}

	/**
	 * Wallet controller for the source side of the swap.
	 * Both sides share the same controller for Uniswap (single-chain swap).
	 * @returns {import('wallet-common-core').WalletController}
	 */
	get sourceWalletController() {
		return this.#walletController;
	}

	/**
	 * Wallet controller for the target side of the swap.
	 * Both sides share the same controller for Uniswap (single-chain swap).
	 * @returns {import('wallet-common-core').WalletController}
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
		const { nativeTokenInfo, wrappedTokenInfo } = await this.#uniswapApi.fetchPoolTokenInfos(
			networkProperties,
			this.#nativeTokenId,
			this.#wrappedTokenId
		);

		this.#nativeTokenInfo = nativeTokenInfo;
		this.#wrappedTokenInfo = wrappedTokenInfo;
	};

	/**
	 * Uniswap does not track on-chain history. Returns an empty array.
	 * @returns {Promise<[]>}
	 */
	fetchRecentHistory = async () => [];

	/**
	 * Estimate how much of the output token will be received for a given input amount
	 * using the Uniswap V3 Quoter contract (on-chain, no gas consumed).
	 * @param {string} amount - Input amount in relative units.
	 * @returns {Promise<UniswapEstimation>}
	 */
	estimateRequest = async amount => {
		if (!this.#nativeTokenInfo)
			throw new Error('Failed to estimate Uniswap swap. Manager not loaded');

		const [sourceTokenInfo, targetTokenInfo] = this.#mode === SwapMode.WRAP
			? [this.#nativeTokenInfo, this.#wrappedTokenInfo]
			: [this.#wrappedTokenInfo, this.#nativeTokenInfo];

		const { networkProperties } = this.#walletController;
		const amountInAbsolute = relativeToAbsoluteAmount(amount, sourceTokenInfo.divisibility);

		const amountOutAbsolute = await this.#uniswapApi.quoteExactInputSingle(networkProperties, this.#quoterAddress, {
			tokenInId: sourceTokenInfo.id,
			tokenOutId: targetTokenInfo.id,
			amountIn: amountInAbsolute,
			fee: this.#poolFee
		});

		const feeAbsolute = BigInt(amountOutAbsolute) * BigInt(this.#poolFee) / 1_000_000n;

		return {
			receiveAmount: absoluteToRelativeAmount(amountOutAbsolute, targetTokenInfo.divisibility),
			bridgeFee: absoluteToRelativeAmount(String(feeAbsolute), targetTokenInfo.divisibility),
			error: null
		};
	};

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

		const [tokenIn, tokenOut] = this.#mode === SwapMode.WRAP
			? [this.#nativeTokenInfo, this.#wrappedTokenInfo]
			: [this.#wrappedTokenInfo, this.#nativeTokenInfo];

		const nonce = await this.#transactionApi.fetchTransactionNonce(networkProperties, currentAccount.address);

		const approveTransaction = {
			type: TransactionType.ERC_20_APPROVE,
			signerPublicKey: currentAccount.publicKey,
			signerAddress: normalizeAddress(currentAccount.address),
			tokenId: tokenIn.id,
			spenderAddress: this.#swapRouterAddress,
			amount,
			divisibility: tokenIn.divisibility,
			nonce,
			fee
		};

		const transaction = {
			type: TransactionType.UNISWAP_SWAP,
			signerPublicKey: currentAccount.publicKey,
			signerAddress: normalizeAddress(currentAccount.address),
			recipientAddress: normalizeAddress(recipientAddress),
			routerAddress: this.#swapRouterAddress,
			sourceToken: {
				...tokenIn,
				amount
			},
			targetToken: {
				...tokenOut,
				amount: amountOutMinimum
			},
			poolFee: this.#poolFee,
			deadline: Math.floor(Date.now() / 1000) + deadlineSeconds,
			sqrtPriceLimitX96: 0,
			nonce: nonce + 1,
			fee
		};

		return new TransactionBundle([approveTransaction, transaction]);
	};
}
