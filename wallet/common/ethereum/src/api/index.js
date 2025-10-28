import { AccountService } from './AccountService';
import { BlockService } from './BlockService';
import { ListenerService } from './ListenerService';
import { NetworkService } from './NetworkService';
import { TokenService } from './TokenService';
import { TransactionService } from './TransactionService';

/**
 * @typedef {object} Config
 * @property {Object.<string,string[]>} erc20TokensAddresses - Map of networkIdentifier (key) to the list of ERC-20 token addresses.
 * @property {Object.<string, string[]>} nodeList - Map of networkIdentifier (key) to node URLs array (values).
 */

export class Api {
	/**
     * @type {AccountService}
     */
	account;

	/**
     * @type {BlockService}
     */
	block;

	/**
     * @type {ListenerService}
     */
	listener;

	/**
     * @type {NetworkService}
     */
	network;

	/**
     * @type {TokenService}
     */
	token;

	/**
     * @type {TransactionService}
     */
	transaction;


	/**
     * Creates an instance of EthereumApi.
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
		this.block = new BlockService(propagatedOptions);
		this.listener = new ListenerService(propagatedOptions);
		this.network = new NetworkService(propagatedOptions);
		this.token = new TokenService(propagatedOptions);
		this.transaction = new TransactionService(propagatedOptions);
	}
}
