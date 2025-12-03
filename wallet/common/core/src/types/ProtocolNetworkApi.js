/** @typedef {import('./Network').NetworkProperties} NetworkProperties */
/** @typedef {import('./Account').PublicAccount} PublicAccount */
/** @typedef {import('./SearchCriteria').TransactionSearchCriteria} TransactionSearchCriteria */
/** @typedef {import('./Transaction').Transaction} Transaction */
/** @typedef {import('./Transaction').SignedTransactionDTO} SignedTransactionDTO */
/** @typedef {import('../lib/models/TransactionBundle').TransactionBundle} TransactionBundle */

/**
 * @callback FetchAccountInfoFn
 * @param {NetworkProperties} networkProperties - The network properties.
 * @param {string} address - The address of the account to fetch information for.
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

/**
 * @callback AnnounceTransactionBundleFn
 * @param {NetworkProperties} networkProperties - The network properties.
 * @param {TransactionBundle} transactionBundle - Transaction bundle that contains signed transactions to announce.
 * @param {string} group - Transaction announce group.
 * @returns {Promise<void>} - A promise that resolves when the transaction is announced.
 * @throws {Error} If the transaction cannot be announced.
 */

/**
 * @callback FetchTransactionStatusFn
 * @param {NetworkProperties} networkProperties - The network properties.
 * @param {string} transactionHash - The hash of the transaction to fetch status for.
 * @returns {Promise<object>} A promise that resolves to the transaction status.
 * @throws {Error} If the transaction status cannot be fetched.
 */

/** @typedef {object} AccountApi
 * @property {FetchAccountInfoFn} fetchAccountInfo
 */

/** @typedef {object} TransactionApi
 * @property {FetchAccountTransactionsFn} fetchAccountTransactions
 * @property {FetchTransactionStatusFn} fetchTransactionStatus
 * @property {AnnounceTransactionFn} announceTransaction
 * @property {AnnounceTransactionBundleFn} announceTransactionBundle
 */

/** @typedef {object} NetworkApi
 * @property {FetchNetworkPropertiesFn} fetchNetworkProperties
 * @property {PingNodeFn} pingNode
 * @property {FetchNodeListFn} fetchNodeList
 */


/** @typedef {object} Listener
 * @property {() => Promise<void>} open
 * @property {() => void} close
 * @property {(group: string, callback: (transaction: Transaction) => void) => void} listenAddedTransactions
 * @property {(group: string, callback: (transaction: Transaction) => void) => void} listenRemovedTransactions
 * @property {(callback: (error: Error) => void) => void} listenTransactionError
 * @property {(callback: (block: { height: number }) => void) => void} listenNewBlock
 */

/** @typedef {object} ListenerApi
 * @property {(networkProperties: NetworkProperties, accountAddress: string) => Listener} createListener
 */

/** @typedef {{
 *   account: AccountApi,
 *   transaction: TransactionApi,
 *   network: NetworkApi,
 *   listener: ListenerApi
 * }} ProtocolNetworkApi
 */

export default {};
