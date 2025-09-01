import { AccountService } from './AccountService';
import { HarvestingService } from './HarvestingService';
import { ListenerService } from './ListenerService';
import { MarketService } from './MarketService';
import { MosaicService } from './MosaicService';
import { NamespaceService } from './NamespaceService';
import { NetworkService } from './NetworkService';
import { TransactionService } from './TransactionService';
/**
 * @typedef {Object} Config
 * @property {Object.<string, string>} marketDataURL - Map of networkIdentifier (key) to market data URL (value).
 * @property {string[]} marketCurrencies - The list of currencies for market data.
 * @property {Object.<string, string>} nodewatchURL - Map of networkIdentifier (key) to node watch service URL (value).
 */

export class Api {
	/**
     * @type {AccountService}
     */
	account;

	/**
     * @type {HarvestingService}
     */
	harvesting;

	/**
     * @type {ListenerService}
     */
	listener;

	/**
     * @type {MarketService}
     */
	market;

	/**
     * @type {MosaicService}
     */
	mosaic;

	/**
     * @type {NamespaceService}
     */
	namespace;

	/**
     * @type {NetworkService}
     */
	network;

	/**
	 * @type {TransactionService}
	 */
	transaction;

	/**
	 * Creates an instance of Api.
	 * @param {object} options - Options for the API.
	 * @param {Function} options.makeRequest - Function to make HTTP requests.
	 * @param {Config} options.config - Configuration object.
	 */
	constructor(options) {
		const propagatedOptions = {
			...options,
			api: this
		};
		this.account = new AccountService(propagatedOptions);
		this.harvesting = new HarvestingService(propagatedOptions);
		this.listener = new ListenerService(propagatedOptions);
		this.market = new MarketService(propagatedOptions);
		this.mosaic = new MosaicService(propagatedOptions);
		this.namespace = new NamespaceService(propagatedOptions);
		this.network = new NetworkService(propagatedOptions);
		this.transaction = new TransactionService(propagatedOptions);
	}
}
