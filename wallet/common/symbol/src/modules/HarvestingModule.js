import { LinkAction, LinkActionMessage, MessageType, TransactionType } from '../constants';
import { addressFromPublicKey, createDeadline, createFee, encodeDelegatedHarvestingMessage, generateKeyPair } from '../utils';
import { shuffle } from 'lodash';
import { ControllerError } from 'wallet-common-core';

/** @typedef {import('../types/Harvesting').HarvestingSummary} HarvestingSummary */
/** @typedef {import('../types/Harvesting').HarvestedBlock} HarvestedBlock */
/** @typedef {import('../types/Harvesting').HarvestingStatus} HarvestingStatus */
/** @typedef {import('../types/SearchCriteria').HarvestedBlockSearchCriteria} HarvestedBlockSearchCriteria */
/** @typedef {import('../types/Transaction').Transaction} Transaction */

export class HarvestingModule {
	static name = 'harvesting';
	#walletController;
	#api;

	constructor() { }

	init = options => {
		this.#walletController = options.walletController;
		this.#api = options.api;
	};

	loadCache = async () => { };

	resetState = () => { };

	clear = () => { };

	/**
	 * Fetches the harvesting status of the current account.
	 * @returns {Promise<HarvestingStatus>} - The harvesting status.
	 */
	fetchStatus = async () => {
		const { currentAccount, networkProperties } = this.#walletController;

		return this.#api.harvesting.fetchStatus(networkProperties, currentAccount);
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
		const { currentAccount, networkProperties } = this.#walletController;
		const { address } = currentAccount;

		return this.#api.harvesting.fetchSummary(networkProperties, address);
	};

	/**
	 * Prepares the transaction to start harvesting for the current account.
	 * Aggregate transaction includes linking the VRF and remote keys, and sending a request to the node.
	 * If the keys are already linked, they will be unlinked first.
	 * @param {object} options - The transaction options.
	 * @param {string} options.nodePublicKey - The public key of the node.
	 * @param {number} [options.fee=0] - The transaction fee.
	 * @param {string} [password] - The wallet password.
	 * @returns {Promise<Transaction>} - The transaction to start harvesting.
	 */
	createStartHarvestingTransaction = async (options, password) => {
		const { nodePublicKey, fee = 0 } = options;
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
		return {
			type: TransactionType.AGGREGATE_COMPLETE,
			innerTransactions: transactions,
			signerPublicKey: accountPublicKey,
			fee: createFee(fee, networkProperties),
			deadline: createDeadline(2, networkProperties.epochAdjustment)
		};
	};

	/**
	 * Prepares the transaction to stop harvesting for the current account.
	 * Aggregate transaction includes unlinking the VRF and remote keys.
	 * @param {object} [options] - The transaction options.
	 * @param {number} [options.fee=0] - The transaction fee.
	 * @returns {Transaction} - The transaction to stop harvesting.
	 */
	createStopHarvestingTransaction = (options = {}) => {
		const { currentAccount, currentAccountInfo, networkProperties } = this.#walletController;
		const accountPublicKey = currentAccount.publicKey;
		const { linkedKeys } = currentAccountInfo;
		const { fee = 0 } = options;
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
		return {
			type: TransactionType.AGGREGATE_COMPLETE,
			innerTransactions: transactions,
			signerPublicKey: accountPublicKey,
			fee: createFee(fee, networkProperties),
			deadline: createDeadline(2, networkProperties.epochAdjustment)
		};
	};
}
