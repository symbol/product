import config from '../config.js';
import cryptoCompareClient from '../services/cryptocompareClient.js';
import stateManager from '../stateManager.js';

const priceUtils = {
	async getPrice({ state }) {
		const price = await cryptoCompareClient.fetchPrice();

		state.currencies = price;

		await stateManager.update(state);
	},
	async getCurrencyPrice({ state, requestParams }) {
		const { currency } = requestParams;

		if (-1 === config.supportCurrency.indexOf(currency.toLowerCase()))
			throw new Error('Currency not supported.');

		return {
			symbol: currency,
			price: state.currencies[currency]
		};
	}
};

export default priceUtils;
