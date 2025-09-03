import { AccountService } from './AccountService';
import { ListenerService } from './ListenerService';
import { NetworkService } from './NetworkService';
import { TransactionService } from './TransactionService';

/**
 * @typedef {object} Config
 * @property {Object.<string,string[]>} erc20TokensAddresses -  Map of networkIdentifier (key) to node the list of ERC-20 token addresses.
 * @property {Object.<string, string[]>} nodeList - Map of networkIdentifier (key) to node URLs array (values).
 */

export class Api {
	/**
     * @type {AccountService}
     */
	account;

	/**
     * @type {ListenerService}
     */
	listener;

	/**
     * @type {NetworkService}
     */
	network;

	/**
     * @type {TransactionService}
     */
	transaction;


	/**
     * Creates an instance of SymbolApi.
     * @param {object} options - Options for the API.
     * @param {(url: string, config?: object) => Promise<any>} options.makeRequest - Function to make HTTP requests.
     * @param {Config} options.config - Configuration object.
     */
	constructor(options) {
		const propagatedOptions = {
			...options,
			api: this
		};
		this.account = new AccountService(propagatedOptions);
		this.listener = new ListenerService(propagatedOptions);
		this.network = new NetworkService(propagatedOptions);
		this.transaction = new TransactionService(propagatedOptions);
	}
}
