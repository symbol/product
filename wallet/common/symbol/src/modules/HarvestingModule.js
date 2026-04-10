import { LinkAction, LinkActionMessage, MessageType, TransactionBundleType, TransactionType } from '../constants';
import { addressFromPublicKey, createDeadline, createTransactionFee, encodeDelegatedHarvestingMessage, generateKeyPair } from '../utils';
import { shuffle } from 'lodash';
import { 
	ControllerError, 
	PersistentStorageRepository, 
	TransactionBundle, 
	cloneNetworkObjectMap, 
	createNetworkMap 
} from 'wallet-common-core';

/** @typedef {import('../types/Harvesting').HarvestingSummary} HarvestingSummary */
/** @typedef {import('../types/Harvesting').HarvestedBlock} HarvestedBlock */
/** @typedef {import('../types/Harvesting').HarvestingStatus} HarvestingStatus */
/** @typedef {import('../types/SearchCriteria').HarvestedBlockSearchCriteria} HarvestedBlockSearchCriteria */
/** @typedef {import('../types/Transaction').Transaction} Transaction */

const createDefaultState = networkIdentifiers => ({
	statuses: createNetworkMap(() => ({}), networkIdentifiers),
	summaries: createNetworkMap(() => ({}), networkIdentifiers)
});

export class HarvestingModule {
	static name = 'harvesting';
	#walletController;
	#api;
	#networkIdentifiers;
	#onStateChange;
	_persistentStorageRepository;
	_state;

	constructor() { }

	/**
	 * Initializes the module with the wallet controller and API.
	 * @param {Object} options - The initialization options.
	 * @param {Object} options.walletController - The wallet controller instance.
	 * @param {Object} options.api - The API instance for network calls.
	 * @param {Object} options.persistentStorageInterface - The persistent storage interface.
	 * @param {string[]} options.networkIdentifiers - Array of network identifiers.
	 * @param {Function} [options.onStateChange] - Callback for state changes.
	 */
	init = options => {
		this.#walletController = options.walletController;
		this.#api = options.api;
		this.#networkIdentifiers = options.networkIdentifiers;
		this.#onStateChange = options.onStateChange;
		this._persistentStorageRepository = new PersistentStorageRepository(options.persistentStorageInterface);
		this._state = createDefaultState(options.networkIdentifiers);
	};

	loadCache = async () => {
		const statuses = await this.#loadHarvestingStatuses();
		const summaries = await this.#loadHarvestingSummaries();

		this.resetState();

		this.#setState(() => {
			this._state.statuses = statuses;
			this._state.summaries = summaries;
		});
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
	 * Gets the cached harvesting status for the current account on the current network.
	 * @returns {HarvestingStatus|null} The cached harvesting status.
	 */
	get status() {
		const { networkIdentifier, currentAccount } = this.#walletController;
		const networkStatuses = this._state.statuses[networkIdentifier];

		return networkStatuses[currentAccount.address] || null;
	}

	/**
	 * Gets the cached harvesting summary for the current account on the current network.
	 * @returns {HarvestingSummary|null} The cached harvesting summary.
	 */
	get summary() {
		const { networkIdentifier, currentAccount } = this.#walletController;
		const networkSummaries = this._state.summaries[networkIdentifier];

		return networkSummaries[currentAccount.address] || null;
	}

	/**
	 * Fetches the harvesting status of the current account.
	 * @returns {Promise<HarvestingStatus>} - The harvesting status.
	 */
	fetchStatus = async () => {
		const { currentAccount, networkIdentifier, networkProperties } = this.#walletController;
		const status = await this.#api.harvesting.fetchStatus(networkProperties, currentAccount);

		await this.#updateCachedHarvestingStatus(status, networkIdentifier, currentAccount.address);

		return status;
	};

	/**
	 * Fetches harvested blocks by current account.
	 * @param {HarvestedBlockSearchCriteria} [searchCriteria] - Pagination params.
	 * @returns {Promise<HarvestedBlock[]>} - The harvested blocks.
	 */
	fetchAccountHarvestedBlocks = async (searchCriteria = {}) => {
		const { currentAccount, networkProperties } = this.#walletController;
		const { address } = currentAccount;

		return this.#api.harvesting.fetchHarvestedBlocks(networkProperties, address, searchCriteria);
	};

	/**
	 * Fetches the node list (API and dual nodes) that are suggested for harvesting.
	 * @returns {Promise<string[]>} - The node list.
	 */
	fetchNodeList = async () => {
		const { networkIdentifier } = this.#walletController;
		const nodeList = await this.#api.harvesting.fetchNodeList(networkIdentifier);

		return shuffle(nodeList);
	};

	/**
	 * Fetches the harvesting summary of current account.
	 * @returns {Promise<HarvestingSummary>} - The harvesting summary.
	 */
	fetchSummary = async () => {
		const { currentAccount, networkIdentifier, networkProperties } = this.#walletController;
		const { address } = currentAccount;
		const summary = await this.#api.harvesting.fetchSummary(networkProperties, address);

		await this.#updateCachedHarvestingSummary(summary, networkIdentifier, address);

		return summary;
	};

	/**
	 * Updates the cached harvesting status for a specific wallet account.
	 * @param {HarvestingStatus} status - The harvesting status to cache.
	 * @param {string} networkIdentifier - The network identifier for which to update the cache.
	 * @param {string} currentAccountAddress - The address of the current wallet account.
	 * @returns {Promise<void>}
	 */
	#updateCachedHarvestingStatus = async (status, networkIdentifier, currentAccountAddress) => {
		const allStatuses = await this.#loadHarvestingStatuses();

		if (!allStatuses[networkIdentifier])
			allStatuses[networkIdentifier] = {};

		allStatuses[networkIdentifier][currentAccountAddress] = status;

		await this._persistentStorageRepository.setHarvestingStatuses(allStatuses);

		this.#setState(() => {
			this._state.statuses = allStatuses;
		});
	};

	/**
	 * Updates the cached harvesting summary for a specific wallet account.
	 * @param {HarvestingSummary} summary - The harvesting summary to cache.
	 * @param {string} networkIdentifier - The network identifier for which to update the cache.
	 * @param {string} currentAccountAddress - The address of the current wallet account.
	 * @returns {Promise<void>}
	 */
	#updateCachedHarvestingSummary = async (summary, networkIdentifier, currentAccountAddress) => {
		const allSummaries = await this.#loadHarvestingSummaries();

		if (!allSummaries[networkIdentifier])
			allSummaries[networkIdentifier] = {};

		allSummaries[networkIdentifier][currentAccountAddress] = summary;

		await this._persistentStorageRepository.setHarvestingSummaries(allSummaries);

		this.#setState(() => {
			this._state.summaries = allSummaries;
		});
	};

	/**
	 * Loads harvesting statuses from persistent storage.
	 * @returns {Promise<Object>} The harvesting statuses map.
	 */
	#loadHarvestingStatuses = async () => {
		const statuses = await this._persistentStorageRepository.getHarvestingStatuses();
		const defaultState = createDefaultState(this.#networkIdentifiers);

		return cloneNetworkObjectMap(
			statuses,
			this.#networkIdentifiers,
			defaultState.statuses
		);
	};

	/**
	 * Loads harvesting summaries from persistent storage.
	 * @returns {Promise<Object>} The harvesting summaries map.
	 */
	#loadHarvestingSummaries = async () => {
		const summaries = await this._persistentStorageRepository.getHarvestingSummaries();
		const defaultState = createDefaultState(this.#networkIdentifiers);

		return cloneNetworkObjectMap(
			summaries,
			this.#networkIdentifiers,
			defaultState.summaries
		);
	};

	/**
	 * Prepares the transaction to start harvesting for the current account.
	 * Aggregate transaction includes linking the VRF and remote keys, and sending a request to the node.
	 * If the keys are already linked, they will be unlinked first.
	 * @param {object} options - The transaction options.
	 * @param {string} options.nodePublicKey - The public key of the node.
	 * @param {number} [options.fee] - The transaction fee.
	 * @param {string} [password] - The wallet password.
	 * @returns {Promise<TransactionBundle>} - The transaction to start harvesting.
	 */
	createStartHarvestingTransaction = async (options, password) => {
		const { nodePublicKey, fee } = options;
		const currentAccountPrivateKey = await this.#walletController.getCurrentAccountPrivateKey(password);
		const { currentAccount, currentAccountInfo, networkIdentifier, networkProperties } = this.#walletController;
		const accountPublicKey = currentAccount.publicKey;
		const { linkedKeys } = currentAccountInfo;
		const nodeAddress = addressFromPublicKey(nodePublicKey, networkIdentifier);

		const vrfAccount = generateKeyPair(networkIdentifier);
		const remoteAccount = generateKeyPair(networkIdentifier);
		const transactions = [];

		// If the keys is already linked to account, unlink them first
		if (linkedKeys.vrfPublicKey) {
			transactions.push({
				type: TransactionType.VRF_KEY_LINK,
				linkAction: LinkActionMessage[LinkAction.Unlink],
				linkedPublicKey: linkedKeys.vrfPublicKey,
				signerPublicKey: accountPublicKey
			});
		}
		if (linkedKeys.linkedPublicKey) {
			transactions.push({
				type: TransactionType.ACCOUNT_KEY_LINK,
				linkAction: LinkActionMessage[LinkAction.Unlink],
				linkedPublicKey: linkedKeys.linkedPublicKey,
				signerPublicKey: accountPublicKey
			});
		}
		if (linkedKeys.nodePublicKey) {
			transactions.push({
				type: TransactionType.NODE_KEY_LINK,
				linkAction: LinkActionMessage[LinkAction.Unlink],
				linkedPublicKey: linkedKeys.nodePublicKey,
				signerPublicKey: accountPublicKey
			});
		}

		// Then link the new ones
		transactions.push({
			type: TransactionType.VRF_KEY_LINK,
			linkAction: LinkActionMessage[LinkAction.Link],
			linkedPublicKey: vrfAccount.publicKey,
			signerPublicKey: accountPublicKey
		});
		transactions.push({
			type: TransactionType.ACCOUNT_KEY_LINK,
			linkAction: LinkActionMessage[LinkAction.Link],
			linkedPublicKey: remoteAccount.publicKey,
			signerPublicKey: accountPublicKey
		});
		transactions.push({
			type: TransactionType.NODE_KEY_LINK,
			linkAction: LinkActionMessage[LinkAction.Link],
			linkedPublicKey: nodePublicKey,
			signerPublicKey: accountPublicKey
		});

		// Request node for harvesting
		transactions.push({
			type: TransactionType.TRANSFER,
			mosaics: [],
			message: {
				type: MessageType.DelegatedHarvesting,
				payload: encodeDelegatedHarvestingMessage(
					currentAccountPrivateKey,
					nodePublicKey,
					remoteAccount.privateKey,
					vrfAccount.privateKey
				),
				text: ''
			},
			signerPublicKey: accountPublicKey,
			recipientAddress: nodeAddress
		});

		// Prepare aggregate transaction
		const aggregateTransaction = {
			type: TransactionType.AGGREGATE_COMPLETE,
			innerTransactions: transactions,
			signerPublicKey: accountPublicKey,
			fee: fee ?? createTransactionFee(networkProperties, '0'),
			deadline: createDeadline(2, networkProperties.epochAdjustment)
		};

		return new TransactionBundle([aggregateTransaction], { type: TransactionBundleType.DELEGATED_HARVESTING });
	};

	/**
	 * Prepares the transaction to stop harvesting for the current account.
	 * Aggregate transaction includes unlinking the VRF and remote keys.
	 * @param {object} [options] - The transaction options.
	 * @param {number} [options.fee] - The transaction fee.
	 * @returns {TransactionBundle} - The transaction to stop harvesting.
	 */
	createStopHarvestingTransaction = (options = {}) => {
		const { currentAccount, currentAccountInfo, networkProperties } = this.#walletController;
		const accountPublicKey = currentAccount.publicKey;
		const { linkedKeys } = currentAccountInfo;
		const { fee } = options;
		const transactions = [];

		// Unlink supplemental key
		if (linkedKeys.vrfPublicKey) {
			transactions.push({
				type: TransactionType.VRF_KEY_LINK,
				linkAction: LinkActionMessage[LinkAction.Unlink],
				linkedPublicKey: linkedKeys.vrfPublicKey,
				signerPublicKey: accountPublicKey
			});
		}
		if (linkedKeys.linkedPublicKey) {
			transactions.push({
				type: TransactionType.ACCOUNT_KEY_LINK,
				linkAction: LinkActionMessage[LinkAction.Unlink],
				linkedPublicKey: linkedKeys.linkedPublicKey,
				signerPublicKey: accountPublicKey
			});
		}
		if (linkedKeys.nodePublicKey) {
			transactions.push({
				type: TransactionType.NODE_KEY_LINK,
				linkAction: LinkActionMessage[LinkAction.Unlink],
				linkedPublicKey: linkedKeys.nodePublicKey,
				signerPublicKey: accountPublicKey
			});
		}

		// If nothing to unlink, then just escape
		if (transactions.length === 0) {
			throw new ControllerError(
				'error_harvesting_no_keys_to_unlink',
				'Failed to create stop harvesting transaction. No keys to unlink.'
			);
		}

		// Prepare aggregate transaction
		const aggregateTransaction = {
			type: TransactionType.AGGREGATE_COMPLETE,
			innerTransactions: transactions,
			signerPublicKey: accountPublicKey,
			fee: fee ?? createTransactionFee(networkProperties, '0'),
			deadline: createDeadline(2, networkProperties.epochAdjustment)
		};

		return new TransactionBundle([aggregateTransaction], { type: TransactionBundleType.DELEGATED_HARVESTING });
	};
}
