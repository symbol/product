import { cloneDeep } from 'lodash';
import { makeAutoObservable, runInAction } from 'mobx';
import { config } from '@/app/config';
import { MarketService } from '@/app/lib/services';

const defaultState = {
    userCurrency: null, // user preferred currency to convert XYM amounts,
    marketData: {
        fetchedAt: 0, // timestamp when the market data is fetched
        prices: {}, // market prices for each currency
    },
};

export class MarketModule {
    constructor({ root, isObservable }) {
        this.name = 'market';
        this._state = cloneDeep(defaultState);

        if (isObservable) makeAutoObservable(this);

        this._root = root;
    }

    get price() {
        const { marketData, userCurrency } = this._state;

        return {
            value: marketData.prices[userCurrency],
            currency: userCurrency,
        };
    }

    /**
     * Initializes the module. Loads the user currency from the persistent storage.
     * @returns {Promise<void>} A promise that resolves when the module is initialized.
     */
    loadCache = async () => {
        const userCurrency = await this._root._persistentStorage.getUserCurrency();

        this.clearState();

        runInAction(() => {
            this._state.userCurrency = userCurrency;
        });
    };

    /**
     * Clears the module state.
     */
    clearState = () => {
        this._state = cloneDeep(defaultState);
    };

    /**
     * Selects the user currency.
     * @param {string} userCurrency - The user currency.
     */
    selectUserCurrency = async (userCurrency) => {
        await this._root._persistentStorage.setUserCurrency(userCurrency);

        runInAction(() => {
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
        const isOldMarketDataOutdated = currentTimestamp - marketData.fetchedAt > config.allowedMarkedDataCallInterval;

        if (!isOldMarketDataOutdated) {
            return marketData;
        }

        const prices = await MarketService.fetchPrices();

        runInAction(() => {
            this._state.marketData = {
                fetchedAt: currentTimestamp,
                prices,
            };
        });
    };
}
