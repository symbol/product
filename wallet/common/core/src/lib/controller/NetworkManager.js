import { NetworkConnectionStatus, TransactionGroup } from '../../constants';
import { AppError } from '../../error/AppError';
import { createNetworkMap } from '../../utils/network';

/** @typedef {import('../../types/Logger').Logger} Logger */

const createDefaultState = (networkIdentifiers, createDefaultNetworkProperties) => ({
	chainListener: null, // listener instance
	networkConnectionTimer: null,
	networkIdentifier: networkIdentifiers[0], // selected network
	networkProperties: createDefaultNetworkProperties(networkIdentifiers[0]), // network properties for the selected network
	networkConnectionStatus: NetworkConnectionStatus.INITIAL, // 'offline' 'failed-auto' 'failed-current' 'connected'
	nodeUrls: createNetworkMap(() => [], networkIdentifiers), // node urls available for each network
	selectedNodeUrl: null // preferred node url, selected by the user
});

export class NetworkManager {
	_state;
	_logger;
	api;
	createDefaultNetworkProperties;
	onConnectionStatusChange;
	onPropertiesUpdate;
	onChainEvent;
	connectionTimer;

	/**
	 * Creates an instance of NetworkManager.
	 * @param {object} options - The constructor options.
	 * @param {Logger} options.logger - Logger instance for logging.
	 * @param {string[]} options.networkIdentifiers - An array of network identifiers supported by the manager.
	 * @param {function} options.createDefaultNetworkProperties - A function that creates default network properties
	 * for a given network identifier.
	 * @param {object} options.api - The API instance providing methods to interact with the network.
	 * @param {number} options.pollingInterval - The interval in milliseconds for polling network status.
	 * @param {function} options.onConnectionStatusChange - Callback function to handle changes in network connection status.
	 * @param {function} options.onPropertiesUpdate - Callback function to handle updates to network properties.
	 * @param {function} options.onChainEvent - Callback function to handle chain events.
	 */
	constructor(options) {
		this._state = createDefaultState(options.networkIdentifiers, options.createDefaultNetworkProperties);
		this._logger = options.logger;
		this.networkIdentifiers = options.networkIdentifiers;
		this.api = options.api;
		this.pollingInterval = options.pollingInterval;
		this.createDefaultNetworkProperties = options.createDefaultNetworkProperties;

		this.onConnectionStatusChange = options.onConnectionStatusChange;
		this.onPropertiesUpdate = options.onPropertiesUpdate;
		this.onChainEvent = options.onChainEvent;
	}

	get nodeUrls() {
		return this._state.nodeUrls;
	}

	get networkProperties() {
		return this._state.networkProperties;
	}

	get networkConnectionStatus() {
		return this._state.networkConnectionStatus;
	}

	/**
	 * Initializes the network manager with the initial values.
	 * @param {string} initialNetworkIdentifier - The selected network identifier.
	 * @param {object} [initialNetworkProperties] - Network properties for the selected network.
	 * @param {string} [initialNodeUrl] - The initial node URL to connect to.
	 * @returns {void}
	 */
	init = (initialNetworkIdentifier, initialNetworkProperties, initialNodeUrl) => {
		this._state.networkIdentifier = initialNetworkIdentifier;
		this._state.networkProperties = initialNetworkProperties || this.createDefaultNetworkProperties(initialNetworkIdentifier);
		this._state.selectedNodeUrl = initialNodeUrl || null;
		this.#setStatus(NetworkConnectionStatus.INITIAL);
	};

	/**
	 * Selects a network by its identifier and updates the node URL.
	 * @param {string} networkIdentifier - The identifier of the network to select.
	 * @param {string} [nodeUrl] - The node URL to connect to.
	 * @returns {void}
	 */
	selectNetwork = async (networkIdentifier, nodeUrl = null) => {
		this._state.networkIdentifier = networkIdentifier;
		this._state.selectedNodeUrl = nodeUrl;
		this.#setNetworkProperties(this.createDefaultNetworkProperties(networkIdentifier));
		this.#setStatus(NetworkConnectionStatus.INITIAL);
	};

	/**
	 * Fetches the list of available nodes for the current network.
	 * @returns {Promise<string[]>} - A promise that resolves to an array of network node URLs.
	 */
	fetchNodeList = async () => {
		const { networkIdentifier } = this._state;
		const updatedList = await this.api.network.fetchNodeList(networkIdentifier);

		this._state.nodeUrls = {
			...this._state.nodeUrls,
			[networkIdentifier]: updatedList
		};

		return updatedList;
	};

	/**
	 * Fetches network properties from the node.
	 * @param {string} nodeUrl - The URL of the node to connect to.
	 * @returns {Promise<object>} - A promise that resolves to the network properties.
	 * @throws {AppError} - If the fetched network identifier does not match the expected network identifier.
	 */
	fetchNetworkProperties = async nodeUrl => {
		const properties = await this.api.network.fetchNetworkProperties(nodeUrl);

		if (properties.networkIdentifier !== this._state.networkIdentifier) {
			throw new AppError(
				'error_fetch_network_properties_wrong_network',
				'Failed to fetch network properties. Wrong network identifier. ' 
				+ `Expected "${this._state.networkIdentifier}", got "${properties.networkIdentifier}"`
			);
		}

		this.#setNetworkProperties(properties);
		this.#setStatus(NetworkConnectionStatus.CONNECTED);

		return properties;
	};

	/**
	 * Starts the network connection job, which periodically checks the connection status and updates it.
	 * @returns {void}
	 */
	runConnectionJob = async () => {
		this.#clearConnectionTimer();

		// Try to connect to current or user selected node
		const currentNodeUrl = this._state.networkProperties?.nodeUrl ?? this._state.selectedNodeUrl;

		if (currentNodeUrl) {
			try {
				await this.fetchNetworkProperties(currentNodeUrl);
				await this.startChainListener();
				this.#scheduleNextRun();
				return this._state.networkConnectionStatus;
			} catch (error) { 
				this._logger.error(`[NetworkManager] Failed to connect to the current node: ${currentNodeUrl}`, error.message);
			}
		}

		// Fetch node list to get the latest available nodes
		// If node list was failed to fetch, and failed to connect to the current node,
		// consider it as no internet connection
		try {
			await this.fetchNodeList();
		} catch (error) {
			this._logger.error('[NetworkManager] Failed to fetch node list.', error.message);
			this.#setStatus(NetworkConnectionStatus.NO_INTERNET);
			this.#scheduleNextRun();
			return this._state.networkConnectionStatus;
		}

		// If the user selected node failed for the second time, set the status to failed
		// Otherwise set the status to connecting
		const isPreviousNetworkStatusConnecting = this._state.networkConnectionStatus === NetworkConnectionStatus.CONNECTING;

		if (this._state.selectedNodeUrl && isPreviousNetworkStatusConnecting)
			this.#setStatus(NetworkConnectionStatus.FAILED_CUSTOM_NODE);
		else
			this.#setStatus(NetworkConnectionStatus.CONNECTING);

		// If there is a selected node by user, skip auto selection
		if (this._state.selectedNodeUrl) {
			this.#scheduleNextRun();
			return this._state.networkConnectionStatus;
		}

		// Auto select the node. Try to connect to the node one by one from the list
		const candidates = this._state.nodeUrls[this._state.networkIdentifier] ?? [];
		for (const nodeUrl of candidates) {
			try {
				await this.api.network.pingNode(nodeUrl);
				await this.fetchNetworkProperties(nodeUrl);
				await this.startChainListener();
				this.#scheduleNextRun();
				return this._state.networkConnectionStatus;
			} catch (error) {
				this._logger.warn(`[NetworkManager] Failed to connect to node: ${nodeUrl}`, error.message);
			}
		}

		this.#setStatus(NetworkConnectionStatus.CONNECTING);
		this.#scheduleNextRun();
		return this._state.networkConnectionStatus;
	};

	/**
	 * Starts the chain listener to listen for blockchain events.
	 * @param {string} accountAddress - The address of the account to listen for events.
	 * @returns {Promise<void>} - A promise that resolves when the listener is successfully started.
	 */
	startChainListener = async accountAddress => {
		this.stopChainListener();

		try {
			const newListener = this.api.listener.createListener(this.networkProperties, accountAddress);
			await newListener.open();
			newListener.listenAddedTransactions(TransactionGroup.CONFIRMED, payload => {
				this.#handleChainEvent(ControllerEventName.NEW_TRANSACTION_CONFIRMED, payload);
			});
			newListener.listenAddedTransactions(TransactionGroup.UNCONFIRMED, payload => {
				this.#handleChainEvent(ControllerEventName.NEW_TRANSACTION_UNCONFIRMED, payload);
			});
			newListener.listenAddedTransactions(TransactionGroup.PARTIAL, payload => {
				this.#handleChainEvent(ControllerEventName.NEW_TRANSACTION_PARTIAL, payload);
			});
			newListener.listenTransactionError(payload => {
				this.#handleChainEvent(ControllerEventName.TRANSACTION_ERROR, payload);
			});
			this._state.chainListener = newListener;
		} catch (error) {
			this._logger.error('[NetworkManager] Failed to start chain listener.', error.message);
			throw new AppError('error_chain_listener_start', 'Failed to start chain listener.');
		}
	};

	/**
	 * Stops the chain listener if it is currently running.
	 * @returns {void}
	 */
	stopChainListener = () => {
		this._state.chainListener?.close();
		this._state.chainListener = null;
	};

	#handleChainEvent = (eventName, payload) => {
		this.onChainEvent?.(eventName, payload);
	};

	#setStatus = status => {
		this._state.networkConnectionStatus = status;
		this.onConnectionStatusChange?.(status);
	};

	#setNetworkProperties = networkProperties => {
		this._state.networkProperties = networkProperties;
		this.onPropertiesUpdate?.(networkProperties);
	};

	#scheduleNextRun = () => {
		this.connectionTimer = setTimeout(() => this.runConnectionJob(), this.pollingInterval);
	};

	#clearConnectionTimer = () => {
		if (this.connectionTimer) {
			clearTimeout(this.connectionTimer);
			this.connectionTimer = undefined;
		}
	};
}
