import { ControllerError } from '../../error/ControllerError';
import { equalDeep } from '../../utils/helper';
import { createNetworkMap } from '../../utils/network';
import { TransactionBundle } from '../models/TransactionBundle';

/** @typedef {import('../controller/WalletController').WalletController} WalletController */
/** @typedef {import('../../types/Bridge').BridgeHelper} BridgeHelper */
/** @typedef {import('../../types/Bridge').BridgeNetworkConfig} BridgeNetworkConfig */
/** @typedef {import('../../types/Network').NetworkMap<string>} NetworkUrlMap */
/** @typedef {import('../../types/Network').NetworkArrayMap<BridgeNetworkConfig>} NetworkConfigMap */
/** @typedef {import('../../types/Token').Token} Token */
/** @typedef {import('../../types/Token').TokenInfo} TokenInfo */

/**
 * @typedef {object} State
 * @property {NetworkConfigMap} configs - Bridge network config.
 */

const createDefaultState = networkIdentifiers => ({
	configs: createNetworkMap(() => [], networkIdentifiers)
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
	 * Bridge helper with protocol-specific logic.
	 * @returns {BridgeHelper} - Bridge helper instance.
	 */
	get bridgeHelper() {
		return this.#bridgeHelper;
	}

	/**
	 * Bridge configs for the current network.
	 * @returns {BridgeNetworkConfig[]} - List of bridge configs for the current network.
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

		this.configs.forEach(config => {
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
	 * Get bridge config for the specific bridge address.
	 * @param {string} bridgeAddress - Bridge account or contract address.
	 * @returns {BridgeNetworkConfig|null} - Bridge config if found, null otherwise.
	 */
	getConfig = bridgeAddress => {
		const config = this.configs.find(c => c.bridgeAddress === bridgeAddress);

		return config || null;
	};

	/**
	 * Check if the specific bridge config is added to the module.
	 * @param {BridgeNetworkConfig} configToTest - Config to check.
	 * @returns {boolean} - True if the config is already added, false otherwise.
	 */
	hasConfig = configToTest => {
		const config = this.getConfig(configToTest.bridgeAddress);

		return config !== null && equalDeep(config, configToTest);
	};

	/**
	 * Set bridge config.
	 * @param {BridgeNetworkConfig} config - Bridge network config.
	 */
	addConfig = config => {
		if (config.network !== this.#walletController.networkIdentifier)
			throw new ControllerError('Failed to add bridge config. Network mismatch');

		if (config.blockchain !== this.#walletController.chainName)
			throw new ControllerError('Failed to add bridge config. Chain name mismatch');

		const isConfigAlreadyAdded = this.hasConfig(config);

		if (isConfigAlreadyAdded)
			return;

		this.#setState(() => {
			this._state.configs[config.network] = [...this._state.configs[config.network], config];
		});
	};

	/**
	 * Create protocol-specific wrap or unwrap transaction via bridge helper.
	 * @param {object} options - Options.
	 * @param {string} options.recipientAddress - destination address to receive wrapped/unwrapped tokens
	 * @param {Token} options.token - token to wrap/unwrap
	 * @param {BridgeNetworkConfig} options.config - bridge source network configuration
	 * @param {number} [options.fee] - transaction fee
	 * @returns {Promise<object>} - transaction object
	 */
	createTransaction = async options => {
		const { recipientAddress, token, config, fee } = options;
		const { currentAccount, networkProperties, networkIdentifier } = this.#walletController;

		// Verify bridge is in the same chain and network as the wallet controller
		if (config.blockchain !== this.#walletController.chainName)
			throw new ControllerError('Failed to create bridge transaction. Chain name mismatch');

		if (config.network !== networkIdentifier)
			throw new ControllerError('Failed to create bridge transaction. Network mismatch');

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

