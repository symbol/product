import { cloneDeep } from 'lodash';
import { makeAutoObservable, runInAction } from 'mobx';
import { config } from 'src/config';
import { MarketService } from 'src/lib/services';

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

        if (isObservable)
            makeAutoObservable(this);

        this._root = root;
    }

    get price() {
        const { marketData, userCurrency } = this._state;

        return {
            value: marketData.prices[userCurrency],
            currency: userCurrency,
        };
    }

    loadCache = async () => {
        const userCurrency = await this._root._persistentStorage.getUserCurrency();

        this.clearState();

        runInAction(() => {
            this._state.userCurrency = userCurrency;
        });
    }

    clearState = () => {
        this._state = cloneDeep(defaultState);
    }

    selectUserCurrency = async (userCurrency) => {
        await this._root._persistentStorage.setUserCurrency(userCurrency);

        runInAction(() => {
            this._state.userCurrency = userCurrency;
        });
    }

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
    }
}
