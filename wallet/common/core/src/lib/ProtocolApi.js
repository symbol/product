import { validateFields } from '../utils/helper';

/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../types/SearchCriteria').TransactionSearchCriteria} TransactionSearchCriteria */
/** @typedef {import('../types/Transaction').Transaction} Transaction */
/** @typedef {import('../types/Transaction').SignedTransactionDTO} SignedTransactionDTO */

/**
 * @callback FetchAccountInfoFn
 * @param {NetworkProperties} networkProperties - The network properties.
 * @param {string} publicKey - The public key of the account.
 * @returns {Promise<object>} A promise that resolves to the account information.
 * @throws {Error} If the account information cannot be fetched.
 */

/**
 * @callback FetchAccountTransactionsFn
 * @param {NetworkProperties} networkProperties - The network properties.
 * @param {PublicAccount} account - The public account to fetch transactions for.
 * @param {TransactionSearchCriteria} searchCriteria - The search criteria for transactions.
 * @returns {Promise<Transaction[]>} A promise that resolves to an array of transactions.
 * @throws {Error} If the transactions cannot be fetched.
 */

/**
 * @callback PingNodeFn
 * @param {string} nodeUrl - The URL of the node to ping.
 * @returns {Promise<void>} A promise that resolves when the ping is successful.
 * @throws {Error} If the ping fails.
 */

/**
 * @callback FetchNetworkPropertiesFn
 * @param {string} nodeUrl - The URL of the node.
 * @returns {Promise<NetworkProperties>} A promise that resolves to the network properties.
 * @throws {Error} If the network properties cannot be fetched.
 */

/**
 * @callback FetchNodeListFn
 * @param {string} networkIdentifier - The identifier of the network.
 * @returns {Promise<string[]>} A promise that resolves to an array of node URLs.
 * @throws {Error} If the node list cannot be fetched.
 */

/**
 * @callback AnnounceTransactionFn
 * @param {NetworkProperties} networkProperties - The network properties.
 * @param {SignedTransactionDTO} dto - The signed transaction DTO.
 * @param {string} group - Transaction announce group.
 * @returns {Promise<void>} - A promise that resolves when the transaction is announced.
 * @throws {Error} If the transaction cannot be announced.
 */

const requiredMethods = [
	'fetchAccountInfo',
	'fetchAccountTransactions',
	'pingNode',
	'fetchNetworkProperties',
	'fetchNodeList',
	'announceTransaction'
];

/**
 * @description This class provides protocol-related API functionality using injected methods.
 */
export class ProtocolApi {
	/**
	 * @type {FetchAccountInfoFn}
	 * @description Fetches account information for a given public key.
	 */
	fetchAccountInfo;

	/**
	 * @type {FetchAccountTransactionsFn}
	 * @description Fetches account transactions for a given account and search criteria.
	 */
	fetchAccountTransactions;

	/**
	 * @type {PingNodeFn}
	 * @description Pings a node to check its availability.
	 */
	pingNode;

	/**
	 * @type {FetchNetworkPropertiesFn}
	 * @description Fetches network properties from the node.
	 */
	fetchNetworkProperties;

	/**
	 * @type {FetchNodeListFn}
	 * @description Fetches the list of available nodes for the current network.
	 */
	fetchNodeList;

	/**
	 * @type {AnnounceTransactionFn}
	 * @description Announces a transaction to the network.
	 */
	announceTransaction;

	/**
	 * @description Creates an instance of ProtocolApi with the required methods.
	 * @param {object} methods - An object containing the required methods.
	 * @param {FetchAccountInfoFn} methods.fetchAccountInfo - Function to fetch account information.
	 * @param {FetchAccountTransactionsFn} methods.fetchAccountTransactions - Function to fetch account transactions.
	 * @param {PingNodeFn} methods.pingNode - Function to ping a node.
	 * @param {FetchNetworkPropertiesFn} methods.fetchNetworkProperties - Function to fetch network properties.
	 * @param {FetchNodeListFn} methods.fetchNodeList - Function to fetch the list of available nodes.
	 * @param {AnnounceTransactionFn} methods.announceTransaction - Function to announce a transaction DTO to the network.
	 * @throws {Error} If any of the required methods are missing or not functions.
	 */
	constructor(methods) {
		validateFields(methods, requiredMethods.map(method => ({ key: method, type: 'function' })));
		const _this = this;
		requiredMethods.forEach(method => {
			_this[method] = methods[method];
		});
	}
}
