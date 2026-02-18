import { ControllerError } from '../../error/ControllerError';
import { createNetworkMap } from '../../utils/network';
import { TransactionBundle } from '../models/TransactionBundle';

/** @typedef {import('../controller/WalletController').WalletController} WalletController */
/** @typedef {import('../../types/Bridge').BridgeHelper} BridgeHelper */
/** @typedef {import('../../types/Bridge').BridgeNetworkConfig} BridgeNetworkConfig */
/** @typedef {import('../../types/Network').NetworkMap<string>} NetworkUrlMap */
/** @typedef {import('../../types/Network').NetworkObjectMap<BridgeNetworkConfig>} NetworkConfigMap */
/** @typedef {import('../../types/Token').Token} Token */
/** @typedef {import('../../types/Token').TokenInfo} TokenInfo */

/**
 * @typedef {object} State
 * @property {NetworkConfigMap} configs - Bridge network config.
 */

const createDefaultState = networkIdentifiers => ({
	configs: createNetworkMap(() => ({}), networkIdentifiers)
});

export class BridgeModule {
	static name = 'bridge';

	/** @type {BridgeHelper} */
	#bridgeHelper;

	/** @type {WalletController} */
	#walletController;

	/** @type {function} */
	#onStateChange;

	/** @type {Array<string>} */
	#networkIdentifiers;

	/** @type {State} */
	_state;

	/**
	 * Create BridgeModule instance.
	 * @param {object} options - Options.
	 * @param {BridgeHelper} options.bridgeHelper - Bridge helper with protocol-specific logic.
	 */
	constructor(options) {
		this.#bridgeHelper = options.bridgeHelper;
	}

	init = options => {
		this.#walletController = options.walletController;
		this.#onStateChange = options.onStateChange;
		this.#networkIdentifiers = options.networkIdentifiers;
		this._state = createDefaultState(this.#networkIdentifiers);
	};

	resetState = () => {
		this._state = createDefaultState(this.#networkIdentifiers);
	};

	clear = () => {
		this.resetState();
	};

	#setState = callback => {
		callback.bind(this);
		callback();
		this.#onStateChange?.();
	};

	/**
	 * Bridge configs for the current network.
	 * @returns {Record<string, BridgeNetworkConfig>} - Map of bridge configs for the current network. Key is bridge ID.
	 */
	get configs() {
		const { networkIdentifier } = this.#walletController;
		
		return this._state.configs[networkIdentifier];
	}

	/**
	 * Tokens participated in the bridge owned by the current account.
	 * Uses all bridge configs for the current network.
	 * @returns {Token[]} - List of unique tokens according to configs; owned amounts or '0' if not owned.
	 */
	get tokens() {
		const { currentAccountInfo } = this.#walletController;
		const allOwnedTokens = currentAccountInfo?.tokens || currentAccountInfo?.mosaics || [];
		const tokensById = new Map();

		Object.values(this.configs).forEach(config => {
			const { tokenInfo } = config;

			if (tokensById.has(tokenInfo.id))
				return;

			const ownedToken = allOwnedTokens.find(t => t.id === tokenInfo.id);

			tokensById.set(tokenInfo.id, {
				...tokenInfo,
				amount: ownedToken ? ownedToken.amount : '0'
			});
		});

		return Array.from(tokensById.values());
	}

	/**
	 * Get bridge config by its ID for the current network.
	 * @param {string} bridgeId - Bridge identifier.
	 * @returns {BridgeNetworkConfig|null} - Bridge config if found, null otherwise.
	 */
	getConfig = bridgeId => {
		const config = this.configs[bridgeId];

		return config || null;
	};

	/**
	 * Add bridge config.
	 * @param {string} bridgeId - Bridge identifier.
	 * @param {BridgeNetworkConfig} config - Bridge network config.
	 */
	addConfig = (bridgeId, config) => {
		if (config.blockchain !== this.#walletController.chainName)
			throw new ControllerError('Failed to add bridge config. Chain name mismatch');

		this.#setState(() => {
			this._state.configs[config.network] = {
				...this._state.configs[config.network],
				[bridgeId]: config
			};
		});
	};

	/**
	 * Remove bridge config from current network.
	 * @param {string} bridgeId - Bridge identifier.
	 */
	removeConfig = bridgeId => {
		const { networkIdentifier } = this.#walletController;

		this.#setState(() => {
			/* eslint-disable-next-line no-unused-vars */
			const {[bridgeId]: _, ...rest} = this._state.configs[networkIdentifier];
			this._state.configs[networkIdentifier] = rest;
		});
	};

	/**
	 * Retrieve token info by it's ID.
	 * @param {string} tokenId - Token identifier.
	 * @returns {Promise<TokenInfo>} - Token info.
	 */
	fetchTokenInfo = async tokenId => {
		const { networkProperties } = this.#walletController;

		return this.#bridgeHelper.fetchTokenInfo(networkProperties, tokenId);
	};

	/**
	 * Create protocol-specific wrap or unwrap transaction via bridge helper.
	 * @param {object} options - Options.
	 * @param {string} options.recipientAddress - destination address to receive wrapped/unwrapped tokens
	 * @param {string} options.amount - amount to wrap/unwrap
	 * @param {string} options.bridgeId - bridge identifier
	 * @param {number} [options.fee] - transaction fee
	 * @returns {Promise<object>} - transaction object
	 */
	createTransaction = async options => {
		const { recipientAddress, amount, bridgeId, fee } = options;
		const { currentAccount, networkProperties } = this.#walletController;

		const config = this.getConfig(bridgeId);

		if (!config)
			throw new ControllerError('Failed to create bridge transaction. Bridge config not found');

		const token = {
			...config.tokenInfo,
			amount
		};

		// Verify current account selected
		if (!currentAccount)
			throw new ControllerError('Failed to create bridge transaction. No current account selected');

		const transaction = await this.#bridgeHelper.createTransaction({
			currentAccount,
			networkProperties,
			recipientAddress,
			bridgeAddress: config.bridgeAddress,
			token,
			fee
		});

		return new TransactionBundle([transaction]);
	};
}

