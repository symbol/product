import { config } from 'src/config';
import { MarketService } from 'src/services';
import { PersistentStorage } from 'src/storage';

export default {
    namespace: 'market',
    state: {
        userCurrency: null, // user preferred currency to convert XYM amounts,
        prices: {},
        price: null,
    },
    mutations: {
        setUserCurrency(state, payload) {
            state.market.userCurrency = payload;
            return state;
        },
        setPrices(state, payload) {
            state.market.prices = payload;
            return state;
        },
        setPrice(state, payload) {
            state.market.price = payload;
            return state;
        },
    },
    actions: {
        // Load data from cache
        loadState: async ({ commit }) => {
            const userCurrency = await PersistentStorage.getUserCurrency();

            commit({ type: 'market/setUserCurrency', payload: userCurrency });
        },
        // Fetch latest data from API
        fetchData: async ({ commit, state }) => {
            const { userCurrency, prices: oldPrices } = state.market;
            const currentTimestamp = Date.now();
            let prices;

            // Fetch new prices if previous prices are unavailable or outdated
            if (
                !oldPrices ||
                !oldPrices.requestTimestamp ||
                currentTimestamp - oldPrices.requestTimestamp > config.allowedMarkedDataCallInterval
            ) {
                prices = await MarketService.fetchPrices();
                console.log('Fetch prices!', new Date().toISOString());
            } else {
                prices = oldPrices;
            }

            const price = {
                value: prices[userCurrency],
                currency: userCurrency,
            };

            commit({ type: 'market/setPrices', payload: prices });
            commit({ type: 'market/setPrice', payload: price });
        },
        // Change and cache the user currency value
        changeUserCurrency: async ({ commit, state }, userCurrency) => {
            const { prices } = state.market;
            await PersistentStorage.setUserCurrency(userCurrency);
            let price;

            if (prices && prices[userCurrency]) {
                price = {
                    value: prices[userCurrency],
                    currency: userCurrency,
                };
            } else {
                price = null;
            }

            commit({ type: 'market/setUserCurrency', payload: userCurrency });
            commit({ type: 'market/setPrice', payload: price });
        },
    },
};
