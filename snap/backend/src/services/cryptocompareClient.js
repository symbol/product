import config from '../config.js';
import fetchUtils from '../utils/fetchUtils.js';

const cryptoCompareClient = {
	/**
	 * Fetch the price of the supported currencies.
	 * @returns {Promise<PriceInfo>} The price of the supported currencies.
	 */
	fetchPrice: async () => {
		try {
			const currencies = config.supportCurrency.join(',');
			const prices = await fetchUtils.fetchData(`${config.cryptoCompareURL}${currencies}`, 'GET');

			return {
				usd: prices.USD,
				jpy: prices.JPY
			};
		} catch (error) {
			throw new Error(`Failed to fetch price from cryptoCompare service: ${error.message}`);
		}
	}
};

export default cryptoCompareClient;

// region type declarations

/**
 * Result of a price request.
 * @typedef {object} PriceInfo
 * @property {number} usd - The conversion rate to US Dollars.
 * @property {number} jpy - The conversion rate to Japanese Yen.
 */

// endregion
