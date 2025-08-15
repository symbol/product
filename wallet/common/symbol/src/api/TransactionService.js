import { TransactionAnnounceGroup, TransactionGroup } from '../constants';
import { 
	createSearchUrl,
	getUnresolvedIdsFromSymbolTransactions,
	getUnresolvedIdsFromTransactionDTOs,
	isAggregateTransactionDTO,
	promiseAllSettled,
	symbolTransactionFromPayload,
	transactionFromDTO,
	transactionFromSymbol 
} from '../utils';
import { ApiError } from 'wallet-common-core';

/** @typedef {import('../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../types/Mosaic').MosaicInfo} MosaicInfo */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/SearchCriteria').TransactionSearchCriteria} TransactionSearchCriteria */
/** @typedef {import('../types/Transaction').Transaction} Transaction */
/** @typedef {import('../types/Transaction').SignedTransactionDTO} SignedTransactionDTO */

export class TransactionService {
	#api;
	#makeRequest;

	constructor(options) {
		this.#api = options.api;
		this.#makeRequest = options.makeRequest;
	}

	/**
     * Fetches transactions of an account.
	 * @param {NetworkProperties} networkProperties - Network properties.
     * @param {PublicAccount} account - Requested account.
     * @param {TransactionSearchCriteria} [searchCriteria] - Search criteria.
     * @returns {Promise<Transaction[]>} - The account transactions.
     */
	fetchAccountTransactions = async (networkProperties, account, searchCriteria = {}) => {
		const { pageNumber = 1, pageSize = 15, group = TransactionGroup.CONFIRMED, order = 'desc', filter = {} } = searchCriteria;
		const baseSearchCriteria = {
			pageNumber,
			pageSize,
			order
		};
		const additionalSearchConditions = {};

		// Set search criteria filters
		if (filter.from) {
			const fromAccount = await this.#api.account.fetchAccountInfo(networkProperties, filter.from);
			additionalSearchConditions.signerPublicKey = fromAccount.publicKey;
			additionalSearchConditions.recipientAddress = account.address;
		} else if (filter.to) {
			additionalSearchConditions.signerPublicKey = account.publicKey;
			additionalSearchConditions.recipientAddress = filter.to;
		} else {
			additionalSearchConditions.address = account.address;
		}
		if (filter.type) 
			additionalSearchConditions.type = filter.type;
        
		// Fetch transactions
		const url = createSearchUrl(
			networkProperties.nodeUrl, 
			`/transactions/${group}`, 
			baseSearchCriteria, 
			additionalSearchConditions
		);
		const transactionPage = await this.#makeRequest(url);
		const transactions = transactionPage.data;

		// Aggregate transactions info is limited. We need to fetch details for each aggregate transaction and include them in the list
		const aggregateTransactionHashes = transactions.filter(isAggregateTransactionDTO).map(transactionDTO => transactionDTO.meta.hash);
		let aggregateDetailedDTOs = [];
		if (aggregateTransactionHashes.length) {
			const transactionDetailsUrl = `${networkProperties.nodeUrl}/transactions/${group}`;
			aggregateDetailedDTOs = await this.#makeRequest(transactionDetailsUrl, {
				method: 'POST',
				body: JSON.stringify({ transactionIds: aggregateTransactionHashes }),
				headers: {
					'Content-Type': 'application/json'
				}
			});
		}

		// Merge aggregate transaction details with the list of transactions
		const transactionsWithAggregate = transactions.map(transactionDTO =>
			isAggregateTransactionDTO(transactionDTO)
				? aggregateDetailedDTOs.find(detailedDTO => detailedDTO.meta.hash === transactionDTO.meta.hash)
				: transactionDTO);

		return this.resolveTransactionDTOs(networkProperties, transactionsWithAggregate, account);
	};

	/**
     * Fetches transaction info by hash.
     * @param {string} hash - Requested transaction hash.
     * @param {object} config - Config.
     * @param {NetworkProperties} config.networkProperties - Network properties.
     * @param {PublicAccount} config.currentAccount - Current account.
     * @param {string} config.group - Transaction group.
     * @returns {Promise<Transaction>} - The transaction info.
     */
	fetchTransactionInfo = async (hash, config) => {
		const { group = TransactionGroup.CONFIRMED, currentAccount, networkProperties } = config;
		const transactionUrl = `${networkProperties.nodeUrl}/transactions/${group}/${hash}`;
		const transactionDTO = await this.#makeRequest(transactionUrl);
		const transactions = await this.resolveTransactionDTOs(networkProperties, [transactionDTO], currentAccount);

		return transactions[0];
	};

	/**
     * Send transaction to the network.
	 * @param {NetworkProperties} networkProperties - Network properties.
     * @param {SignedTransactionDTO} dto - The signed transaction DTO.
     * @param {string} group - Transaction announce group.
     * @returns {Promise<void>} - A promise that resolves when the transaction is announced.
     * @throws {ApiError} - If the transaction is not accepted by any node.
     */
	announceTransaction = async (networkProperties, dto, group) => {
		const randomNodes = networkProperties.nodeUrls.sort(() => Math.random() - 0.5).slice(0, 3);
		const nodeUrls = [networkProperties.nodeUrl, ...randomNodes];
		const promises = nodeUrls.map(nodeUrl => this.announceTransactionToNode(nodeUrl, dto, group));

		const results = await promiseAllSettled(promises);
		const hasSuccessfulResult = results.some(r => r.status === 'fulfilled');

		if (!hasSuccessfulResult) {
			const error = results.find(r => r.status === 'rejected').reason;
			throw new ApiError(error);
		}
	};

	/**
     * Announce transaction to a single node.
	 * @param {string} nodeUrl - The node URL.
     * @param {SignedTransactionDTO} dto - The signed transaction DTO.
     * @param {string} group - Transaction announce group.
     * @returns {Promise<void>} - A promise that resolves when the transaction is announced.
     * @throws {ApiError} - If the transaction is not accepted by the node.
     */
	announceTransactionToNode = async (nodeUrl, dto, group = TransactionAnnounceGroup.DEFAULT) => {
		const typeEndpointMap = {
			[TransactionAnnounceGroup.DEFAULT]: '/transactions',
			[TransactionAnnounceGroup.PARTIAL]: '/transactions/partial',
			[TransactionAnnounceGroup.COSIGNATURE]: '/transactions/cosignature'
		};
		const endpoint = `${nodeUrl}${typeEndpointMap[group]}`;

		return this.#makeRequest(endpoint, {
			method: 'PUT',
			body: JSON.stringify(dto),
			headers: {
				'Content-Type': 'application/json'
			}
		});
	};

	fetchStatus = async (hash, networkProperties) => {
		const endpoint = `${networkProperties.nodeUrl}/transactionStatus/${hash}`;
		const { group } = await this.#makeRequest(endpoint);

		return {
			group
		};
	};

	/**
	 * Resolves addresses, mosaics and namespaces for transaction DTOs.
	 * @typedef {object} ResolvedTransactionData
	 * @property {object.<string, MosaicInfo>} mosaicInfos - Resolved mosaic information.
	 * @property {object.<string, string>} namespaceNames - Resolved namespace names.
	 * @property {object.<string, string>} resolvedAddresses - Resolved addresses.
	 * 
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {object} data - The transaction data, containing unresolved ids.
	 * @param {string[]} data.addresses - The namespace ids of the unresolved addresses aliases.
	 * @param {string[]} data.mosaicIds - The ids of the unresolved mosaics.
	 * @param {string[]} data.namespaceIds - The ids of the unresolved namespaces.
	 * @returns {Promise<ResolvedTransactionData>} - The resolved data.
	 */
	resolveTransactionData = async (networkProperties, data) => {
		// Resolve addresses, mosaics and namespaces
		const { addresses, mosaicIds, namespaceIds } = data;
		const mosaicInfos = await this.#api.mosaic.fetchMosaicInfos(networkProperties, mosaicIds);
		const namespaceNames = await this.#api.namespace.fetchNamespaceNames(networkProperties, namespaceIds);
		const resolvedAddresses = await this.#api.namespace.resolveAddressesAtHeight(networkProperties, addresses);

		return {
			mosaicInfos,
			namespaceNames,
			resolvedAddresses
		};
	};

	/**
     * Resolves transactions DTO. Fetches additional information for unresolved ids. Maps transactionDTOs to the transaction objects.
	 * @param {NetworkProperties} networkProperties - Network properties.
     * @param {object[]} transactionDTOs - The transaction DTOs.
     * @param {PublicAccount} currentAccount - Current account.
     * @returns {Promise<Transaction[]>} - The resolved transactions
     */
	resolveTransactionDTOs = async (networkProperties, transactionDTOs, currentAccount) => {
		const unresolvedTransactionData = getUnresolvedIdsFromTransactionDTOs(transactionDTOs);
		const resolvedTransactionData = await this.resolveTransactionData(networkProperties, unresolvedTransactionData);
		const config = {
			...resolvedTransactionData,
			currentAccount,
			networkProperties
		};
		return transactionDTOs.map(transactionDTO => transactionFromDTO(transactionDTO, config));
	};

	/**
     * Creates a transaction object from a payload. Resolves amounts and ids.
	 * @param {NetworkProperties} networkProperties - Network properties.
     * @param {string} payload - The transaction payload.
     * @param {PublicAccount} currentAccount - Current account.
     * @param {string} [fillSignerPublickey] - The public key to fill the signer if field is empty.
     * @returns {Promise<Transaction>} - The transaction object.
     */
	resolveTransactionFromPayload = async (networkProperties, payload, currentAccount, fillSignerPublickey) => {
		const symbolTransaction = symbolTransactionFromPayload(payload);
		const unresolvedTransactionData = getUnresolvedIdsFromSymbolTransactions([symbolTransaction]);
		const resolvedTransactionData = await this.resolveTransactionData(networkProperties, unresolvedTransactionData);
		const config = {
			...resolvedTransactionData,
			currentAccount,
			networkProperties,
			fillSignerPublickey
		};

		return transactionFromSymbol(symbolTransaction, config);
	};
}
