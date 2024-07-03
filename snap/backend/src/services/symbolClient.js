import fetchUtils from '../utils/fetchUtils.js';

const symbolClient = {
	create(nodeUrl) {
		return {
			/**
			 * Fetch native mosaic from network properties.
			 * @returns {Promise<string>} the network currency mosaic id
			 */
			fetchNetworkCurrencyMosaicId: async () => {
				try {
					const { chain } = await fetchUtils.fetchData(`${nodeUrl}/network/properties`);
					return chain.currencyMosaicId.slice(2).replace(/'/g, '');
				} catch (error) {
					throw new Error(`Failed to fetch network properties info: ${error.message}`);
				}
			}
		};
	}
};

export default symbolClient;
