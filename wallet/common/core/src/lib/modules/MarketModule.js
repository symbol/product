import { PersistentStorageRepository } from '../storage/PersistentStorageRepository';

const ALLOWED_MARKET_DATA_CALL_INTERVAL = 60000;
const DEFAULT_CURRENCY = 'USD';

const createDefaultState = () => ({
	userCurrency: null, // user preferred currency to convert token amounts,
	marketData: {
		fetchedAt: 0, // timestamp when the market data is fetched
		prices: {} // market prices for each currency
	}
});

export class MarketModule {
	static name = 'market';

	#persistentStorageRepository;
	#api;
	#onStateChange;

	constructor(options) {
		this._state = createDefaultState();
		this.#persistentStorageRepository = new PersistentStorageRepository(options.persistentStorageInterface);
		this.#api = options.api;
		this.#onStateChange = options.onStateChange;
	}

	/**
	 * Current token price in user currency.
	 * @returns {{ value: number, currency: string }} - The current token price in user currency.
	 */
	get price() {
		const { marketData, userCurrency } = this._state;

		return {
			value: marketData.prices[userCurrency],
			currency: userCurrency
		};
	}

	/**
	 * Initializes the module. Loads the user currency from the persistent storage.
	 * @returns {Promise<void>} A promise that resolves when the module is initialized.
	 */
	loadCache = async () => {
		const userCurrency = await this.#persistentStorageRepository.getUserCurrency();

		this.resetState();

		this.#setState(() => {
			this._state.userCurrency = userCurrency || DEFAULT_CURRENCY;
		});
	};

	/**
	 * Clears the module state.
	 */
	resetState = () => {
		this._state = createDefaultState();
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
	 * Selects the user currency.
	 * @param {string} userCurrency - The user currency.
	 */
	selectUserCurrency = async userCurrency => {
		await this.#persistentStorageRepository.setUserCurrency(userCurrency);

		this.#setState(() => {
			this._state.userCurrency = userCurrency;
		});
	};

	/**
	 * Fetches an actual market data.
	 * @returns {Promise<void>} - A promise that resolves when the market data is fetched.
	 */
	fetchData = async () => {
		const { marketData } = this._state;
		const currentTimestamp = Date.now();

		// Fetch new prices if previous market data is unavailable or outdated
		const isOldMarketDataOutdated = currentTimestamp - marketData.fetchedAt > ALLOWED_MARKET_DATA_CALL_INTERVAL;

		if (!isOldMarketDataOutdated)
			return marketData;

		const prices = await this.#api.market.fetchPrices();


		this.#setState(() => {
			this._state.marketData = {
				fetchedAt: currentTimestamp,
				prices
			};
		});
	};
}
