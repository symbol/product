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

export class BridgeManager {
	/** @type {WalletControllerWithBridgeModule} */
	#nativeWalletController;

	/** @type {WalletControllerWithBridgeModule} */
	#wrappedWalletController;

	/** @type {BridgeApi} */
	#bridgeApi;

	/** @type {BridgeConfig|null} */
	#config;

	/** @type {string} */
	#id;

	/**
	 * Create BridgeManager instance.
	 * @param {object} options - Options.
	 * @param {string} options.id - Custom provided ID to identify the bridge manager.
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
		this.#id = options.id ?? [
			this.#nativeWalletController.chainName, 
			this.#wrappedWalletController.chainName
		].sort().join('-');
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
	 * Get bridge manager ID.
	 * @returns {string} - Bridge manager ID.
	 */
	get id() {
		return this.#id;
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
	 * Create a SwapSideInfo object for a given wallet controller.
	 * @param {WalletControllerWithBridgeModule} walletController - Wallet controller.
	 * @param {TokenInfo} tokenInfo - Token info.
	 * @returns {SwapSideInfo} - Swap side information.
	 */
	#createSwapSideInfo = (walletController, tokenInfo) => ({
		chainName: walletController.chainName,
		tokenInfo,
		normalizeAddress: walletController.walletSdk.normalizeAddress,
		normalizeTransactionHash: walletController.walletSdk.normalizeTransactionHash
	});

	/**
	 * Get swap context with source and target information based on mode.
	 * @param {string} mode - 'wrap' or 'unwrap'
	 * @returns {SwapContext} - Swap context with source and target information.
	 */
	#getSwapContext = mode => {
		const sourceWalletController = this.#getSourceWalletController(mode);
		const targetWalletController = this.#getTargetWalletController(mode);
		const sourceToken = this.#getSourceToken(mode);
		const targetToken = this.#getTargetToken(mode);

		return {
			mode,
			source: this.#createSwapSideInfo(sourceWalletController, sourceToken),
			target: this.#createSwapSideInfo(targetWalletController, targetToken)
		};
	};

	/**
	 * Fetch bridge configuration, source and target token infos, and register tokens in wallet controllers. 
	 * @returns {Promise} - Promise that resolves when loading is complete.
	 */
	load = async () => {
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
		const isNetworkTypeMatch = config.nativeNetwork.network === nativeNetworkIdentifier;
		const isWrappedNetworkTypeMatch = config.wrappedNetwork.network === wrappedNetworkIdentifier;

		if (!isNativeChainMatch || !isWrappedChainMatch) 
			throw new Error('Failed to load bridge config. Bridge networks do not match wallet controller chains.');

		if (!isNetworkTypeMatch || !isWrappedNetworkTypeMatch)
			throw new Error('Failed to load bridge config. Bridge networks do not match wallet controller networks.');

		// Fetch source and target token infos from chains using helpers
		const nativeBridgeModule = this.#nativeWalletController.modules.bridge;
		const wrappedBridgeModule = this.#wrappedWalletController.modules.bridge;
		
		const [nativeToken, wrappedToken] = await Promise.all([
			nativeBridgeModule.fetchTokenInfo(config.nativeNetwork.tokenId),
			wrappedBridgeModule.fetchTokenInfo(config.wrappedNetwork.tokenId)
		]);
		
		delete config.nativeNetwork.tokenId;
		delete config.wrappedNetwork.tokenId;
		config.nativeNetwork.tokenInfo = nativeToken;
		config.wrappedNetwork.tokenInfo = wrappedToken;
		config.nativeNetwork.bridgeAddress = this.#nativeWalletController.walletSdk.normalizeAddress(config.nativeNetwork.bridgeAddress);
		config.wrappedNetwork.bridgeAddress = this.#wrappedWalletController.walletSdk.normalizeAddress(config.wrappedNetwork.bridgeAddress);

		// Update state
		this.#config = config;

		this.#nativeWalletController.modules.bridge.addConfig(this.id, config.nativeNetwork);
		this.#wrappedWalletController.modules.bridge.addConfig(this.id, config.wrappedNetwork);
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
		
		const filteredByRequestHash = allData.filter((request, index, self) =>
			index === self.findIndex(item => 
				item.requestTransaction.hash === request.requestTransaction.hash));
		const sortedByTimestamp = filteredByRequestHash.sort((a, b) => b.requestTransaction.timestamp - a.requestTransaction.timestamp);

		// Return only the requested number of items
		return sortedByTimestamp.slice(0, count);
	};

	/**
	 * Fetch pending requests that was sent to the bridge.
	 * @param {string} mode - 'wrap' or 'unwrap'
	 * @param {object} searchCriteria - Search criteria.
	 * @param {number} searchCriteria.pageSize - Number of items to fetch.
	 * @param {number} searchCriteria.pageNumber - Page number.
	 * @returns {Promise<BridgeRequest[]>} - List of requests.
	 */
	fetchSentRequests = async (mode, { pageSize, pageNumber } = {}) => {
		if (!this.#config)
			throw new Error('Failed to fetch sent requests. No bridge config fetched');

		const walletController = this.#getSourceWalletController(mode);
		const bridgeAddress = mode === BridgeMode.WRAP
			? this.#config.nativeNetwork.bridgeAddress
			: this.#config.wrappedNetwork.bridgeAddress;
		const transactions = await walletController.fetchAccountTransactions({
			to: bridgeAddress,
			pageSize,
			pageNumber
		});
		const context = this.#getSwapContext(mode);
		const filteredTransactions = transactions.filter(tx =>
			tx.recipientAddress 
			&& context.source.normalizeAddress(tx.recipientAddress) === bridgeAddress);
		
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
		const context = this.#getSwapContext(mode);

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
		const context = this.#getSwapContext(mode);

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
	 * Convert a transaction to a pending bridge request.
	 * @param {object} transaction - The transaction object.
	 * @param {SwapContext} context - Swap context with source and target information.
	 * @returns {BridgeRequest} - The pending bridge request.
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
	 * @param {SwapContext} context - Swap context with source and target information.
	 * @returns {BridgeRequest} - Mapped request object.
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
	 * @param {SwapContext} context - Swap context with source and target information.
	 * @returns {BridgeError} - Mapped error object.
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
