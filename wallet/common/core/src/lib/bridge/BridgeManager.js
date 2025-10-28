import { BridgeApi } from './BridgeApi';
import { absoluteToRelativeAmount, relativeToAbsoluteAmount } from '../../utils/convert';

/** @typedef {import('../controller/WalletController').WalletController} WalletController */
/** @typedef {import('../modules/BridgeModule').BridgeModule} BridgeModule */

/**
 * @typedef {Object} WalletControllerModules
 * @property {BridgeModule} bridge - The bridge module.
 */
/** @typedef {WalletController & { modules: WalletControllerModules }} WalletControllerWithBridgeModule  */

/** @typedef {import('../../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../../types/Bridge').BridgeHelper} BridgeHelper */
/** @typedef {import('../../types/Bridge').BridgeNetworkConfig} BridgeNetworkConfig */
/** @typedef {import('../../types/Bridge').BridgeConfig} BridgeConfig */
/** @typedef {import('../../types/Bridge').RequestTransaction} RequestTransaction */
/** @typedef {import('../../types/Bridge').PayoutTransaction} PayoutTransaction */
/** @typedef {import('../../types/Bridge').BridgeRequest} BridgeRequest */
/** @typedef {import('../../types/Bridge').BridgeError} BridgeError */
/** @typedef {import('../../types/Bridge').BridgeEstimation} BridgeEstimation */
/** @typedef {import('../../types/Network').NetworkMap<string>} NetworkUrlMap */
/** @typedef {import('../../types/Token').Token} Token */
/** @typedef {import('../../types/Token').TokenInfo} TokenInfo */


const BridgeMode = {
	WRAP: 'wrap',
	UNWRAP: 'unwrap'
};

export class BridgeManager {
	/** @type {WalletControllerWithBridgeModule} */
	#nativeWalletController;

	/** @type {WalletControllerWithBridgeModule} */
	#wrappedWalletController;

	/** @type {BridgeApi} */
	#bridgeApi;

	/** @type {BridgeConfig|null} */
	#config;

	/**
     * Create BridgeManager instance.
     * @param {object} options - Options.
     * @param {WalletControllerWithBridgeModule} options.nativeWalletController - Wallet controller for the native chain.
     * @param {WalletControllerWithBridgeModule} options.wrappedWalletController - Wallet controller for the wrapped chain.
     * @param {NetworkUrlMap} options.bridgeUrls - Map of network identifiers to bridge API base URLs.
     * @param {Function} options.makeRequest - Function to make HTTP requests. Should return a Promise that resolves to parsed JSON.
     */
	constructor(options) {
		this.#nativeWalletController = options.nativeWalletController;
		this.#wrappedWalletController = options.wrappedWalletController;
		this.#config = null;
		this.#bridgeApi = new BridgeApi({
			bridgeUrls: options.bridgeUrls,
			makeRequest: options.makeRequest,
			networkIdentifier: null
		});
	}

	get isEnabled() {
		if (!this.#config) 
			return false;

		return this.#config.enabled;
	}
    
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
     * @returns {BridgeConfig|null} - The current bridge configuration, or null if not loaded.
     */
	get config() {
		return this.#config;
	}

	/**
     * Get native network bridge token info.
     * @returns {TokenInfo|null} - Token info of the native network, or null if not loaded.
     */
	get nativeTokenInfo() {
		return this.#config ? this.#config.nativeNetwork.tokenInfo : null;
	}

	/**
     * Get wrapped network bridge token info.
     * @returns {TokenInfo|null} - Token info of the wrapped network, or null if not loaded.
     */
	get wrappedTokenInfo() {
		return this.#config ? this.#config.wrappedNetwork.tokenInfo : null;
	}

	/**
     * Get native network wallet controller.
     * @returns {WalletControllerWithBridgeModule} - Wallet controller for the native chain.
     */
	get nativeWalletController() {
		return this.#nativeWalletController;
	}

	/**
     * Get wrapped network wallet controller.
     * @returns {WalletControllerWithBridgeModule} - Wallet controller for the wrapped chain.
     */
	get wrappedWalletController() {
		return this.#wrappedWalletController;
	}

	/**
     * Get wallet controller by chain name.
     * @param {string} chainName - Chain name.
     * @returns {WalletControllerWithBridgeModule|null} - Wallet controller for the specified chain, or null if not found.
     */
	getWalletController = chainName => {
		const controllers = [this.#nativeWalletController, this.#wrappedWalletController];
        
		return controllers.find(c => c.chainName === chainName) || null;
	};

	/**
     * Fetch bridge configuration, source and target token infos, and register tokens in wallet controllers. 
     * @returns {Promise} - Promise that resolves when loading is complete.
     */
	load = async () => {
		// Clear config
		this.#config = null;
		this.#bridgeApi.setNetworkIdentifier(null);

		// Get network identifiers from both wallet controllers
		const nativeNetworkIdentifier = this.#nativeWalletController.networkIdentifier;
		const wrappedNetworkIdentifier = this.#wrappedWalletController.networkIdentifier;

		if (nativeNetworkIdentifier !== wrappedNetworkIdentifier)
			throw new Error('Failed to load bridge config. Wallet controller network identifier mismatch.');

		this.#bridgeApi.setNetworkIdentifier(nativeNetworkIdentifier);

		// Fetch config from bridge API
		const config = await this.#bridgeApi.fetchConfig();

		// Validate config
		const isNativeChainMatch = config.nativeNetwork.blockchain === this.#nativeWalletController.chainName;
		const isWrappedChainMatch = config.wrappedNetwork.blockchain === this.#wrappedWalletController.chainName;

		if (!isNativeChainMatch || !isWrappedChainMatch) 
			throw new Error('Failed to load bridge config. Bridge networks do not match wallet controller chains.');

		// Fetch source and target token infos from chains using helpers
		const nativeBridgeHelper = this.#nativeWalletController.modules.bridge.bridgeHelper;
		const wrappedBridgeHelper = this.#wrappedWalletController.modules.bridge.bridgeHelper;
        
		const [nativeToken, wrappedToken] = await Promise.all([
			nativeBridgeHelper.fetchTokenInfo(
				this.#nativeWalletController.networkProperties,
				config.nativeNetwork.tokenId
			),
			wrappedBridgeHelper.fetchTokenInfo(
				this.#wrappedWalletController.networkProperties,
				config.wrappedNetwork.tokenId
			)
		]);
        
		delete config.nativeNetwork.tokenId;
		delete config.wrappedNetwork.tokenId;
		config.nativeNetwork.tokenInfo = nativeToken;
		config.wrappedNetwork.tokenInfo = wrappedToken;

		// Update state
		this.#config = config;

		this.#nativeWalletController.modules.bridge.addConfig(config.nativeNetwork);
		this.#wrappedWalletController.modules.bridge.addConfig(config.wrappedNetwork);
	};

	/**
     * Fetch recent requests for both wrap and unwrap modes.
     * @param {number} count - Number of requests to fetch.
     * @returns {Promise<BridgeRequest[]>} - List of recent requests.
     */
	fetchRecentHistory = async count => {
		const [wrapRequests, unwrapRequests, wrapErrors, unwrapErrors, wrapPending, unwrapPending] = await Promise.all([
			this.fetchRequests(BridgeMode.WRAP, { pageSize: count, pageNumber: 1 }),
			this.fetchRequests(BridgeMode.UNWRAP, { pageSize: count, pageNumber: 1 }),
			this.fetchErrors(BridgeMode.WRAP, { pageSize: count, pageNumber: 1 }),
			this.fetchErrors(BridgeMode.UNWRAP, { pageSize: count, pageNumber: 1 }),
			this.fetchSentRequests(BridgeMode.WRAP, { pageSize: count, pageNumber: 1 }),
			this.fetchSentRequests(BridgeMode.UNWRAP, { pageSize: count, pageNumber: 1 })
		]);

		// Merge and sort by request transaction timestamp descending
		const allData = [...wrapRequests, ...unwrapRequests, ...wrapErrors, ...unwrapErrors, ...wrapPending, ...unwrapPending];
		const normalizeHash = hash => hash.startsWith('0x') ? hash.slice(2).toUpperCase() : hash.toUpperCase();
		const filteredByRequestHash = allData.filter((request, index, self) =>
			index === self.findIndex(item => 
				normalizeHash(item.requestTransaction.hash) === normalizeHash(request.requestTransaction.hash)));
		const sortedByTimestamp = filteredByRequestHash.sort((a, b) => b.requestTransaction.timestamp - a.requestTransaction.timestamp);

		// Return only the requested number of items
		return sortedByTimestamp.slice(0, count);
	};

	/**
     * Fetch pending requests that was sent to the bridge.
    fetchPendingRequests
     * @param {string} mode - 'wrap' or 'unwrap'
     * @param {object} searchCriteria - Search criteria.
     * @param {number} searchCriteria.pageSize - Number of items to fetch.
     * @param {number} searchCriteria.pageNumber - Page number.
     * @returns {Promise<BridgeRequest[]>} - List of requests.
     */
	fetchSentRequests = async (mode, { pageSize, pageNumber } = {}) => {
		const walletController = this.#getSourceWalletController(mode);
		const bridgeAddress = mode === BridgeMode.WRAP
			? this.#config.nativeNetwork.bridgeAddress
			: this.#config.wrappedNetwork.bridgeAddress;
		const transactions = await walletController.fetchAccountTransactions({
			to: bridgeAddress,
			pageSize,
			pageNumber
		});
		const lowercaseBridgeAddress = bridgeAddress.toLowerCase();
		const filteredTransactions = transactions.filter(tx => tx.recipientAddress?.toLowerCase() === lowercaseBridgeAddress);
		const context = {
			mode,
			sourceToken: this.#getSourceToken(mode),
			targetToken: this.#getTargetToken(mode),
			sourceChainName: walletController.chainName,
			targetChainName: this.#getTargetWalletController(mode).chainName
		};

		return filteredTransactions.map(transaction => this.#transactionToPendingRequest(transaction, context));
	};

	/**
     * Fetch requests for current account address that are picked by the bridge.
     * @param {string} mode - 'wrap' or 'unwrap'
     * @param {object} searchCriteria - Search criteria.
     * @param {number} searchCriteria.pageSize - Number of items to fetch.
     * @param {number} searchCriteria.pageNumber - Page number.
     * @returns {Promise<BridgeRequest[]>} - List of requests.
     */
	fetchRequests = async (mode, { pageSize, pageNumber } = {}) => {
		const currentAccount = this.#getCurrentAccount(mode);

		if (!currentAccount)
			throw new Error('Failed to fetch bridge requests. No current account selected');

		if (!this.#config)
			throw new Error('Failed to fetch bridge requests. No bridge config fetched');

		const requestDtos = await this.#bridgeApi.fetchRequests(mode, currentAccount.address, { pageSize, pageNumber });
		const context = {
			mode,
			sourceToken: this.#getSourceToken(mode),
			targetToken: this.#getTargetToken(mode),
			sourceChainName: this.#getSourceWalletController(mode).chainName,
			targetChainName: this.#getTargetWalletController(mode).chainName
		};

		return requestDtos.map(dto => this.#requestFromDto(dto, context));
	};

	/**
     * Fetch errors for current account address.
     * @param {string} mode - 'wrap' or 'unwrap'
     * @param {object} searchCriteria - Search criteria.
     * @param {number} searchCriteria.pageSize - Number of items to fetch.
     * @param {number} searchCriteria.pageNumber - Page number.
     * @returns {Promise<BridgeError[]>} - List of errors.
     */
	fetchErrors = async (mode, { pageSize, pageNumber } = {}) => {
		const currentAccount = this.#getCurrentAccount(mode);

		if (!currentAccount)
			throw new Error('Failed to fetch errors. No current account selected');

		if (!this.#config)
			throw new Error('Failed to fetch errors. No bridge config fetched');

		const errorDtos = await this.#bridgeApi.fetchErrors(mode, currentAccount.address, { pageSize, pageNumber });
		const context = {
			mode,
			sourceToken: this.#getSourceToken(mode),
			targetToken: this.#getTargetToken(mode),
			sourceChainName: this.#getSourceWalletController(mode).chainName,
			targetChainName: this.#getTargetWalletController(mode).chainName
		};

		return errorDtos.map(dto => this.#errorFromDto(dto, context));
	};

	/**
	 * Estimate bridge fee and how much user will receive.
     * @param {string} mode - 'wrap' or 'unwrap'
     * @param {string} amount - Amount to be sent to bridge in relative units.
     * @returns {Promise<BridgeEstimation>} - Estimation result.
     */
	estimateRequest = async (mode, amount) => {
		const recipientAccount = this.#getRecipientAccount(mode);

		if (!recipientAccount)
			throw new Error('Failed to estimate bridge request. No recipient account selected');

		const sourceToken = this.#getSourceToken(mode);
		const targetToken = this.#getTargetToken(mode);
		const absoluteAmount = relativeToAbsoluteAmount(amount, sourceToken.divisibility);
        
		try {
			const estimationDto = await this.#bridgeApi.estimateRequest(mode, absoluteAmount, recipientAccount.address);

			return this.#estimationFromDto(estimationDto, { targetToken });
		} catch (error) {
			return {
				error: {
					/* eslint-disable-next-line max-len */
					isAmountHigh: error.message === 'eth_estimateGas RPC call failed: execution reverted: ERC20: transfer amount exceeds balance'
				}
			};
		}
	};

	#transactionToPendingRequest(transaction, context) {
		const { mode, sourceToken, targetToken, sourceChainName, targetChainName } = context;

		return {
			type: mode,
			requestStatus: 'confirmed',
			sourceChainName,
			targetChainName,
			sourceTokenInfo: sourceToken,
			targetTokenInfo: targetToken,
			requestTransaction: {
				signerAddress: transaction.senderAddress,
				hash: transaction.hash,
				height: transaction.height,
				timestamp: transaction.timestamp
			}
		};
	}

	/**
     * Map request DTO to request object.
     * @param {object} dto - Request DTO from the bridge
     * @param {object} context - Context information
     * @param {string} context.mode - 'wrap' or 'unwrap'
     * @param {TokenInfo} context.sourceToken - Source token info
     * @param {TokenInfo} context.targetToken - Target token info
     * @param {string} context.sourceChainName - Source chain name
     * @param {string} context.targetChainName - Target chain name
     * @returns {BridgeRequest} - Mapped request object
     */
	#requestFromDto(dto, { mode, sourceToken, targetToken, sourceChainName, targetChainName }) {
		const requestTransaction = {
			signerAddress: dto.senderAddress,
			hash: dto.requestTransactionHash,
			height: dto.requestTransactionHeight ?? null,
			timestamp: Math.trunc(dto.requestTimestamp * 1000),
			token: {
				...sourceToken,
				amount: absoluteToRelativeAmount(dto.requestAmount, sourceToken.divisibility)
			}
		};
		const payoutTransaction = dto.payoutTransactionHash ? {
			recipientAddress: dto.destinationAddress,
			hash: dto.payoutTransactionHash,
			height: dto.payoutTransactionHeight ?? null,
			timestamp: Math.trunc(dto.payoutTimestamp * 1000),
			token: {
				...targetToken,
				amount: absoluteToRelativeAmount(dto.payoutNetAmount, targetToken.divisibility)
			}
		} : null;

		return {
			type: mode,
			sourceChainName,
			targetChainName,
			sourceTokenInfo: sourceToken,
			targetTokenInfo: targetToken,
			payoutStatus: dto.payoutStatus,
			payoutConversionRate: dto.payoutConversionRate
				? absoluteToRelativeAmount(dto.payoutConversionRate, targetToken.divisibility)
				: null,
			payoutTotalFee: dto.payoutTotalFee
				? absoluteToRelativeAmount(dto.payoutTotalFee, targetToken.divisibility)
				: null,
			requestTransaction,
			payoutTransaction
		};
	}

	/**
     * Private: Map error DTO to error object.
     * @param {object} dto - Error DTO from the bridge
     * @param {object} context - Context information
     * @param {string} context.mode - 'wrap' or 'unwrap'
     * @param {TokenInfo} context.sourceToken - Source token info
     * @param {TokenInfo} context.targetToken - Target token info
     * @param {string} context.sourceChainName - Source chain name
     * @param {string} context.targetChainName - Target chain name
     * @returns {BridgeError} - Mapped error object
     */
	#errorFromDto(dto, { mode, sourceToken, targetToken, sourceChainName, targetChainName }) {
		const requestTransaction = {
			signerAddress: dto.senderAddress,
			hash: dto.requestTransactionHash,
			height: dto.requestTransactionHeight ?? null,
			timestamp: Math.trunc(dto.requestTimestamp * 1000)
		};

		return {
			type: mode,
			requestStatus: 'error',
			sourceChainName,
			targetChainName,
			sourceTokenInfo: sourceToken,
			targetTokenInfo: targetToken,
			errorMessage: dto.errorMessage,
			requestTransaction
		};
	}

	/**
     * Map estimation DTO to estimation object.
     * @param {object} dto - Estimation DTO from the bridge
     * @returns {BridgeEstimation} - Mapped estimation object
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
     * Get current account from the appropriate wallet controller based on mode.
     * @param {string} mode - 'wrap' or 'unwrap'
     * @return {PublicAccount|null} - Current account or null if not set
     */
	#getCurrentAccount = mode => {
		switch (mode) {
		case BridgeMode.WRAP:
			return this.#nativeWalletController.currentAccount;
		case BridgeMode.UNWRAP:
			return this.#wrappedWalletController.currentAccount;
		default:
			throw new Error(`Invalid bridge mode: ${mode}`);
		}
	};

	/**
     * Get recipient account from the appropriate wallet controller based on mode.
     * @param {string} mode - 'wrap' or 'unwrap'
     * @return {PublicAccount|null} - Recipient account or null if not set
     */
	#getRecipientAccount = mode => {
		switch (mode) {
		case BridgeMode.WRAP:
			return this.#wrappedWalletController.currentAccount;
		case BridgeMode.UNWRAP:
			return this.#nativeWalletController.currentAccount;
		default:
			throw new Error(`Invalid bridge mode: ${mode}`);
		}
	};

	/**
     * Get source token that will be sent for bridging.
     * @param {string} mode - 'wrap' or 'unwrap'
     * @return {Token|null} - Source token or null if not loaded
     */
	#getSourceToken = mode => {
		switch (mode) {
		case BridgeMode.WRAP:
			return this.nativeTokenInfo;
		case BridgeMode.UNWRAP:
			return this.wrappedTokenInfo;
		default:
			throw new Error(`Invalid bridge mode: ${mode}`);
		}
	};

	/**
     * Get target token that will be received after bridging.
     * @param {string} mode - 'wrap' or 'unwrap'
     * @return {Token|null} - Target token or null if not loaded
     */
	#getTargetToken = mode => {
		switch (mode) {
		case BridgeMode.WRAP:
			return this.wrappedTokenInfo;
		case BridgeMode.UNWRAP:
			return this.nativeTokenInfo;
		default:
			throw new Error(`Invalid bridge mode: ${mode}`);
		}
	};

	/**
     * Get source wallet controller based on mode.
     * @param {string} mode - 'wrap' or 'unwrap'
     * @return {WalletControllerWithBridgeModule} - Source wallet controller
     */
	#getSourceWalletController = mode => {
		switch (mode) {
		case BridgeMode.WRAP:
			return this.#nativeWalletController;
		case BridgeMode.UNWRAP:
			return this.#wrappedWalletController;
		default:
			throw new Error(`Invalid bridge mode: ${mode}`);
		}
	};

	/**
     * Get target wallet controller based on mode.
     * @param {string} mode - 'wrap' or 'unwrap'
     * @return {WalletControllerWithBridgeModule} - Target wallet controller
     */
	#getTargetWalletController = mode => {
		switch (mode) {
		case BridgeMode.WRAP:
			return this.#wrappedWalletController;
		case BridgeMode.UNWRAP:
			return this.#nativeWalletController;
		default:
			throw new Error(`Invalid bridge mode: ${mode}`);
		}
	};
}
