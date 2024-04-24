import { axiosErrorHandler, client } from '../utils/axiosRequest.js';
import { PrivateKey } from 'symbol-sdk';
import { SymbolFacade } from 'symbol-sdk/symbol';

const createSymbolClient = ({ endpoint, faucetPrivateKey }) => ({
	axios: client(endpoint),
	/**
	 * Gets account balance.
	 * @param {string} address Account address.
	 * @returns {Promise<object>} Account balance.
	 */
	async getAccountInfo(address) {
		try {
			const response = await this.axios.get(`/accounts/${address}`);

			return { response };
		} catch (error) {
			if (404 === error.response?.status) {
				return {
					response: error.response
				};
			}
			return axiosErrorHandler(error);
		}
	},

	/**
	 * Gets timestamp from network.
	 * @returns {Promise<object>} Timestamp.
	 */
	async getNetworkTime() {
		try {
			const response = await this.axios.get('/node/time');
			return { response };
		} catch (error) {
			return axiosErrorHandler(error);
		}
	},

	/**
	 * Gets network properties from network.
	 * @returns {Promise<object>} network properties.
	 */
	async getNetworkProperties() {
		try {
			const response = await this.axios.get('/network/properties');

			return { response };
		} catch (error) {
			return axiosErrorHandler(error);
		}
	},

	/**
	 * Gets unconfirmed transfer transactions from account.
	 * @param {string} address recipient address.
	 * @returns {Promise<Array>} Transactions.
	 */
	async getUnconfirmedTransferTransactions(address) {
		const privateKey = new PrivateKey(faucetPrivateKey);
		const faucetPublicKey = new SymbolFacade.KeyPair(privateKey).publicKey.toString();
		try {
			const response = await this.axios.get(`/transactions/unconfirmed?recipientAddress=${address}`
					+ `&signerPublicKey=${faucetPublicKey}&type=16724`);
			return { response };
		} catch (error) {
			return axiosErrorHandler(error);
		}
	},

	/**
	 * Announce payload to the network.
	 * @param {string} payload - Signed transaction payload.
	 * @returns {object} Announce transaction status.
	 */
	async announceTransaction(payload) {
		try {
			const response = await this.axios.put('/transactions', payload);
			return { response };
		} catch (error) {
			return axiosErrorHandler(error);
		}
	}
});

export default createSymbolClient;
