import { BridgeApi } from './BridgeApi';
import { absoluteToRelativeAmount, relativeToAbsoluteAmount } from '../../utils/convert';
import { TransactionBundle } from '../models/TransactionBundle';

/** @typedef {import('../controller/WalletController').WalletController} WalletController */
/** @typedef {import('../../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../../types/Bridge').BridgeHelper} BridgeHelper */
/** @typedef {import('../../types/Bridge').BridgeConfig} BridgeConfig */
/** @typedef {import('../../types/Bridge').BridgeRequest} BridgeRequest */
/** @typedef {import('../../types/Bridge').BridgeError} BridgeError */
/** @typedef {import('../../types/Bridge').BridgeEstimation} BridgeEstimation */
/** @typedef {import('../../types/Network').NetworkMap<string>} NetworkUrlMap */
/** @typedef {import('../../types/Token').TokenInfo} TokenInfo */

/**
 * @typedef {Object} SwapSideInfo
 * @property {string} chainName - The blockchain name.
 * @property {TokenInfo} tokenInfo - Token info for this side of the swap.
 * @property {function(string): string} normalizeAddress - Function to normalize an address for this chain.
 * @property {function(string): string} normalizeTransactionHash - Function to normalize a transaction hash for this chain.
 */

/**
 * @typedef {Object} SwapContext
 * @property {string} mode - The bridge mode ('wrap' or 'unwrap').
 * @property {SwapSideInfo} source - Source side information.
 * @property {SwapSideInfo} target - Target side information.
 */

const BridgeMode = {
	WRAP: 'wrap',
	UNWRAP: 'unwrap'
};

export class BridgePairManager {
	/** @type {WalletController} */
	#nativeWalletController;

	/** @type {WalletController} */
	#wrappedWalletController;

	/** @type {BridgeApi} */
	#bridgeApi;

	/** @type {BridgeConfig|null} */
	#config;

	/** @type {string} */
	#mode;

	/** @type {BridgeHelper} */
	#nativeBridgeHelper;

	/** @type {BridgeHelper} */
	#wrappedBridgeHelper;

	/**
	 * Create BridgePairManager instance.
	 * @param {object} options - Options.
	 * @param {string} options.mode - Fixed bridge direction: 'wrap' or 'unwrap'.
	 * @param {WalletController} options.nativeWalletController - Wallet controller for the native chain.
	 * @param {WalletController} options.wrappedWalletController - Wallet controller for the wrapped chain.
	 * @param {BridgeHelper} options.nativeBridgeHelper - Chain-specific bridge helper for the native chain.
	 * @param {BridgeHelper} options.wrappedBridgeHelper - Chain-specific bridge helper for the wrapped chain.
	 * @param {NetworkUrlMap} options.bridgeUrls - Map of network identifiers to bridge API base URLs.
	 * @param {Function} options.makeRequest - Function to make HTTP requests. Should return a Promise that resolves to parsed JSON.
	 */
	constructor(options) {
		this.#nativeWalletController = options.nativeWalletController;
		this.#wrappedWalletController = options.wrappedWalletController;
		this.#nativeBridgeHelper = options.nativeBridgeHelper;
		this.#wrappedBridgeHelper = options.wrappedBridgeHelper;
		this.#config = null;
		this.#bridgeApi = new BridgeApi({
			bridgeUrls: options.bridgeUrls,
			makeRequest: options.makeRequest,
			networkIdentifier: null
		});

		if (options.mode !== BridgeMode.WRAP && options.mode !== BridgeMode.UNWRAP)
			throw new Error(`Invalid bridge mode: ${options.mode}. Must be 'wrap' or 'unwrap'`);

		this.#mode = options.mode;
	}

	/**
	 * Bridge history is always supported.
	 * @returns {boolean}
	 */
	get hasHistory() {
		return true;
	}

	/**
	 * Whether the bridge is enabled (requires config to be loaded).
	 * @returns {boolean}
	 */
	get isEnabled() {
		if (!this.#config)
			return false;

		return this.#config.enabled;
	}

	/**
	 * Whether the manager is fully ready to create transactions.
	 * @returns {boolean}
	 */
	get isReady() {
		const isNativeWalletControllerReady = this.#nativeWalletController.isWalletReady;
		const isWrappedWalletControllerReady = this.#wrappedWalletController.isWalletReady;
		const isConfigLoaded = this.#config !== null;
		const isControllerNetworkMatch = this.#nativeWalletController.networkIdentifier ===
			this.#wrappedWalletController.networkIdentifier;
		const isBridgeApiNetworkMatch = this.#nativeWalletController.networkIdentifier ===
			this.#bridgeApi.networkIdentifier;

		return isNativeWalletControllerReady
			&& isWrappedWalletControllerReady
			&& isConfigLoaded
			&& isControllerNetworkMatch
			&& isBridgeApiNetworkMatch;
	}

	/**
	 * Get the current bridge configuration.
	 * @returns {BridgeConfig|null}
	 */
	get config() {
		return this.#config;
	}


	/**
	 * Get the fixed bridge direction.
	 * @returns {string} - 'wrap' or 'unwrap'
	 */
	get mode() {
		return this.#mode;
	}

	/**
	 * Get native network bridge token info.
	 * @returns {TokenInfo|null}
	 */
	get nativeTokenInfo() {
		return this.#config ? this.#config.nativeNetwork.tokenInfo : null;
	}

	/**
	 * Get wrapped network bridge token info.
	 * @returns {TokenInfo|null}
	 */
	get wrappedTokenInfo() {
		return this.#config ? this.#config.wrappedNetwork.tokenInfo : null;
	}

	/**
	 * Get token info for the source side of the fixed mode.
	 * @returns {TokenInfo|null}
	 */
	get sourceTokenInfo() {
		return this.#mode === BridgeMode.WRAP ? this.nativeTokenInfo : this.wrappedTokenInfo;
	}

	/**
	 * Get token info for the target side of the fixed mode.
	 * @returns {TokenInfo|null}
	 */
	get targetTokenInfo() {
		return this.#mode === BridgeMode.WRAP ? this.wrappedTokenInfo : this.nativeTokenInfo;
	}

	/**
	 * Get native network wallet controller.
	 * @returns {WalletController}
	 */
	get nativeWalletController() {
		return this.#nativeWalletController;
	}

	/**
	 * Get wrapped network wallet controller.
	 * @returns {WalletController}
	 */
	get wrappedWalletController() {
		return this.#wrappedWalletController;
	}

	/**
	 * Get the wallet controller for the source side of the fixed mode.
	 * @returns {WalletController}
	 */
	get sourceWalletController() {
		return this.#mode === BridgeMode.WRAP
			? this.#nativeWalletController
			: this.#wrappedWalletController;
	}

	/**
	 * Get the wallet controller for the target side of the fixed mode.
	 * @returns {WalletController}
	 */
	get targetWalletController() {
		return this.#mode === BridgeMode.WRAP
			? this.#wrappedWalletController
			: this.#nativeWalletController;
	}

	/**
	 * Get wallet controller by chain name.
	 * @param {string} chainName - Chain name.
	 * @returns {WalletController|null}
	 */
	getWalletController = chainName => {
		const controllers = [this.#nativeWalletController, this.#wrappedWalletController];

		return controllers.find(c => c.chainName === chainName) || null;
	};

	/**
	 * Create a SwapSideInfo object for a given wallet controller.
	 * @param {WalletController} walletController - Wallet controller.
	 * @param {TokenInfo} tokenInfo - Token info.
	 * @returns {SwapSideInfo}
	 */
	#createSwapSideInfo = (walletController, tokenInfo) => ({
		chainName: walletController.chainName,
		tokenInfo,
		normalizeAddress: walletController.walletSdk.normalizeAddress,
		normalizeTransactionHash: walletController.walletSdk.normalizeTransactionHash
	});

	/**
	 * Get swap context with source and target information for the fixed mode.
	 * @returns {SwapContext}
	 */
	#getSwapContext = () => {
		const sourceToken = this.sourceTokenInfo;
		const targetToken = this.targetTokenInfo;

		return {
			mode: this.#mode,
			source: this.#createSwapSideInfo(this.sourceWalletController, sourceToken),
			target: this.#createSwapSideInfo(this.targetWalletController, targetToken)
		};
	};

	/**
	 * Fetch bridge configuration, source and target token infos, and register tokens in wallet controllers.
	 * @returns {Promise<void>}
	 */
	load = async () => {
		const nativeNetworkIdentifier = this.#nativeWalletController.networkIdentifier;
		const wrappedNetworkIdentifier = this.#wrappedWalletController.networkIdentifier;

		if (nativeNetworkIdentifier !== wrappedNetworkIdentifier)
			throw new Error('Failed to load bridge config. Wallet controller network identifier mismatch.');

		this.#bridgeApi.setNetworkIdentifier(nativeNetworkIdentifier);

		const config = await this.#bridgeApi.fetchConfig();

		const isNativeChainMatch = config.nativeNetwork.blockchain === this.#nativeWalletController.chainName;
		const isWrappedChainMatch = config.wrappedNetwork.blockchain === this.#wrappedWalletController.chainName;
		const isNetworkTypeMatch = config.nativeNetwork.network === nativeNetworkIdentifier;
		const isWrappedNetworkTypeMatch = config.wrappedNetwork.network === wrappedNetworkIdentifier;

		if (!isNativeChainMatch || !isWrappedChainMatch)
			throw new Error('Failed to load bridge config. Bridge networks do not match wallet controller chains.');

		if (!isNetworkTypeMatch || !isWrappedNetworkTypeMatch)
			throw new Error('Failed to load bridge config. Bridge networks do not match wallet controller networks.');

		const [nativeToken, wrappedToken] = await Promise.all([
			this.#nativeBridgeHelper.fetchTokenInfo(this.#nativeWalletController.networkProperties, config.nativeNetwork.tokenId),
			this.#wrappedBridgeHelper.fetchTokenInfo(this.#wrappedWalletController.networkProperties, config.wrappedNetwork.tokenId)
		]);

		delete config.nativeNetwork.tokenId;
		delete config.wrappedNetwork.tokenId;
		config.nativeNetwork.tokenInfo = nativeToken;
		config.wrappedNetwork.tokenInfo = wrappedToken;
		config.nativeNetwork.bridgeAddress = this.#nativeWalletController.walletSdk.normalizeAddress(config.nativeNetwork.bridgeAddress);
		config.wrappedNetwork.bridgeAddress = this.#wrappedWalletController.walletSdk.normalizeAddress(config.wrappedNetwork.bridgeAddress);

		this.#config = config;
	};

	/**
	 * Fetch recent history for the fixed mode (requests, errors, and pending).
	 * @param {number} count - Number of items to return.
	 * @returns {Promise<Array<BridgeRequest|BridgeError>>}
	 */
	fetchRecentHistory = async count => {
		const [requests, errors, pending] = await Promise.all([
			this.fetchRequests({ pageSize: count, pageNumber: 1 }),
			this.fetchErrors({ pageSize: count, pageNumber: 1 }),
			this.fetchSentRequests({ pageSize: count, pageNumber: 1 })
		]);

		const allData = [...requests, ...errors, ...pending];

		const filteredByRequestHash = allData.filter((request, index, self) =>
			index === self.findIndex(item =>
				item.requestTransaction.hash === request.requestTransaction.hash));
		const sortedByTimestamp = filteredByRequestHash.sort((a, b) => b.requestTransaction.timestamp - a.requestTransaction.timestamp);

		return sortedByTimestamp.slice(0, count);
	};

	/**
	 * Fetch pending requests that were sent to the bridge.
	 * @param {object} searchCriteria - Search criteria.
	 * @param {number} searchCriteria.pageSize - Number of items to fetch.
	 * @param {number} searchCriteria.pageNumber - Page number.
	 * @returns {Promise<BridgeRequest[]>}
	 */
	fetchSentRequests = async ({ pageSize, pageNumber } = {}) => {
		if (!this.#config)
			throw new Error('Failed to fetch sent requests. No bridge config fetched');

		const bridgeAddress = this.#mode === BridgeMode.WRAP
			? this.#config.nativeNetwork.bridgeAddress
			: this.#config.wrappedNetwork.bridgeAddress;
		const transactions = await this.sourceWalletController.fetchAccountTransactions({
			to: bridgeAddress,
			pageSize,
			pageNumber
		});
		const context = this.#getSwapContext();
		const filteredTransactions = transactions.filter(tx =>
			tx.recipientAddress
			&& context.source.normalizeAddress(tx.recipientAddress) === bridgeAddress);

		return filteredTransactions.map(transaction => this.#transactionToPendingRequest(transaction, context));
	};

	/**
	 * Fetch requests for the current account that are picked by the bridge.
	 * @param {object} searchCriteria - Search criteria.
	 * @param {number} searchCriteria.pageSize - Number of items to fetch.
	 * @param {number} searchCriteria.pageNumber - Page number.
	 * @returns {Promise<BridgeRequest[]>}
	 */
	fetchRequests = async ({ pageSize, pageNumber } = {}) => {
		const currentAccount = this.#getCurrentAccount();

		if (!currentAccount)
			throw new Error('Failed to fetch bridge requests. No current account selected');

		if (!this.#config)
			throw new Error('Failed to fetch bridge requests. No bridge config fetched');

		const requestDtos = await this.#bridgeApi.fetchRequests(this.#mode, currentAccount.address, { pageSize, pageNumber });
		const context = this.#getSwapContext();

		return requestDtos.map(dto => this.#requestFromDto(dto, context));
	};

	/**
	 * Fetch errors for the current account.
	 * @param {object} searchCriteria - Search criteria.
	 * @param {number} searchCriteria.pageSize - Number of items to fetch.
	 * @param {number} searchCriteria.pageNumber - Page number.
	 * @returns {Promise<BridgeError[]>}
	 */
	fetchErrors = async ({ pageSize, pageNumber } = {}) => {
		const currentAccount = this.#getCurrentAccount();

		if (!currentAccount)
			throw new Error('Failed to fetch errors. No current account selected');

		if (!this.#config)
			throw new Error('Failed to fetch errors. No bridge config fetched');

		const errorDtos = await this.#bridgeApi.fetchErrors(this.#mode, currentAccount.address, { pageSize, pageNumber });
		const context = this.#getSwapContext();

		return errorDtos.map(dto => this.#errorFromDto(dto, context));
	};

	/**
	 * Estimate bridge fee and how much the user will receive.
	 * @param {string} amount - Amount to be sent to the bridge in relative units.
	 * @returns {Promise<BridgeEstimation>}
	 */
	estimateRequest = async amount => {
		const recipientAccount = this.#getRecipientAccount();

		if (!recipientAccount)
			throw new Error('Failed to estimate bridge request. No recipient account selected');

		const sourceToken = this.sourceTokenInfo;
		const targetToken = this.targetTokenInfo;
		const absoluteAmount = relativeToAbsoluteAmount(amount, sourceToken.divisibility);

		try {
			const estimationDto = await this.#bridgeApi.estimateRequest(this.#mode, absoluteAmount, recipientAccount.address);

			return this.#estimationFromDto(estimationDto, { targetToken });
		} catch (error) {
			/* eslint-disable-next-line max-len */
			const isAmountHighError = error.message === 'eth_estimateGas RPC call failed: execution reverted: ERC20: transfer amount exceeds balance';

			if (!isAmountHighError)
				throw error;

			return {
				error: {
					isAmountHigh: true
				}
			};
		}
	};

	/**
	 * Create a bridge transaction for the fixed mode.
	 * @param {object} options - Options.
	 * @param {string} options.recipientAddress - Destination address on the target chain.
	 * @param {string} options.amount - Amount to bridge in relative units.
	 * @param {number} [options.fee] - Transaction fee.
	 * @returns {Promise<TransactionBundle>}
	 */
	createTransaction = async ({ recipientAddress, amount, fee } = {}) => {
		if (!this.#config)
			throw new Error('Failed to create bridge transaction. No bridge config fetched');

		const { currentAccount } = this.sourceWalletController;

		if (!currentAccount)
			throw new Error('Failed to create bridge transaction. No current account selected');

		const sourceNetworkConfig = this.#mode === BridgeMode.WRAP
			? this.#config.nativeNetwork
			: this.#config.wrappedNetwork;

		const token = { ...this.sourceTokenInfo, amount };

		const bridgeHelper = this.#mode === BridgeMode.WRAP
			? this.#nativeBridgeHelper
			: this.#wrappedBridgeHelper;

		const transaction = await bridgeHelper.createTransaction({
			currentAccount,
			networkProperties: this.sourceWalletController.networkProperties,
			recipientAddress,
			bridgeAddress: sourceNetworkConfig.bridgeAddress,
			token,
			fee
		});

		return new TransactionBundle([transaction]);
	};

	/**
	 * Convert a transaction to a pending bridge request.
	 * @param {object} transaction - The transaction object.
	 * @param {SwapContext} context - Swap context.
	 * @returns {BridgeRequest}
	 */
	#transactionToPendingRequest(transaction, context) {
		const { mode, source, target } = context;

		if (!source.tokenInfo || !target.tokenInfo)
			throw new Error('Failed to create pending request. Token info is not available');

		const transactionTokens = transaction.mosaics ?? transaction.tokens ?? [];

		return {
			type: mode,
			requestStatus: 'confirmed',
			sourceChainName: source.chainName,
			targetChainName: target.chainName,
			sourceTokenInfo: source.tokenInfo,
			targetTokenInfo: target.tokenInfo,
			requestTransaction: {
				signerAddress: source.normalizeAddress(transaction.signerAddress),
				hash: source.normalizeTransactionHash(transaction.hash),
				height: transaction.height,
				timestamp: transaction.timestamp,
				token: transactionTokens[0] ?? null
			}
		};
	}

	/**
	 * Map request DTO to request object.
	 * @param {object} dto - Request DTO from the bridge.
	 * @param {SwapContext} context - Swap context.
	 * @returns {BridgeRequest}
	 */
	#requestFromDto(dto, { mode, source, target }) {
		if (!source.tokenInfo || !target.tokenInfo)
			throw new Error('Failed to map request from DTO. Token info is not available');

		const requestTransaction = {
			signerAddress: source.normalizeAddress(dto.senderAddress),
			hash: source.normalizeTransactionHash(dto.requestTransactionHash),
			height: dto.requestTransactionHeight ?? null,
			timestamp: Math.trunc(dto.requestTimestamp * 1000),
			token: {
				...source.tokenInfo,
				amount: absoluteToRelativeAmount(dto.requestAmount, source.tokenInfo.divisibility)
			}
		};
		const payoutTransaction = dto.payoutTransactionHash ? {
			recipientAddress: target.normalizeAddress(dto.destinationAddress),
			hash: target.normalizeTransactionHash(dto.payoutTransactionHash),
			height: dto.payoutTransactionHeight ?? null,
			timestamp: Math.trunc(dto.payoutTimestamp * 1000),
			token: {
				...target.tokenInfo,
				amount: absoluteToRelativeAmount(dto.payoutNetAmount, target.tokenInfo.divisibility)
			}
		} : null;

		return {
			type: mode,
			sourceChainName: source.chainName,
			targetChainName: target.chainName,
			sourceTokenInfo: source.tokenInfo,
			targetTokenInfo: target.tokenInfo,
			payoutStatus: dto.payoutStatus,
			payoutConversionRate: dto.payoutConversionRate
				? absoluteToRelativeAmount(dto.payoutConversionRate, target.tokenInfo.divisibility)
				: null,
			payoutTotalFee: dto.payoutTotalFee
				? absoluteToRelativeAmount(dto.payoutTotalFee, target.tokenInfo.divisibility)
				: null,
			requestTransaction,
			payoutTransaction
		};
	}

	/**
	 * Map error DTO to error object.
	 * @param {object} dto - Error DTO from the bridge.
	 * @param {SwapContext} context - Swap context.
	 * @returns {BridgeError}
	 */
	#errorFromDto(dto, { mode, source, target }) {
		const requestTransaction = {
			signerAddress: source.normalizeAddress(dto.senderAddress),
			hash: source.normalizeTransactionHash(dto.requestTransactionHash),
			height: dto.requestTransactionHeight ?? null,
			timestamp: Math.trunc(dto.requestTimestamp * 1000)
		};

		return {
			type: mode,
			requestStatus: 'error',
			sourceChainName: source.chainName,
			targetChainName: target.chainName,
			sourceTokenInfo: source.tokenInfo,
			targetTokenInfo: target.tokenInfo,
			errorMessage: dto.errorMessage,
			requestTransaction
		};
	}

	/**
	 * Map estimation DTO to estimation object.
	 * @param {object} dto - Estimation DTO from the bridge.
	 * @param {object} options - Options.
	 * @param {TokenInfo} options.targetToken - Target token info.
	 * @returns {BridgeEstimation}
	 */
	#estimationFromDto(dto, { targetToken }) {
		const isValidAmount = !dto.netAmount.includes('-');

		return {
			bridgeFee: absoluteToRelativeAmount(dto.totalFee, targetToken.divisibility),
			receiveAmount: isValidAmount
				? absoluteToRelativeAmount(dto.netAmount, targetToken.divisibility)
				: '0',
			error: isValidAmount ? null : { isAmountLow: true }
		};
	}

	/**
	 * Get current (source) account for the fixed mode.
	 * @returns {PublicAccount|null}
	 */
	#getCurrentAccount = () => this.sourceWalletController.currentAccount;

	/**
	 * Get recipient (target) account for the fixed mode.
	 * @returns {PublicAccount|null}
	 */
	#getRecipientAccount = () => this.targetWalletController.currentAccount;
}
