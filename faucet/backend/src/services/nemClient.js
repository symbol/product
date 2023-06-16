import { axiosErrorHandler, client } from '../utils/axiosRequest.js';

const createNemClient = ({ endpoint }) => ({
	axios: client(endpoint),

	/**
	 * Gets account balance.
	 * @param {string} address Account address.
	 * @returns {Promise<object>} Account balance.
	 */
	async getAccountInfo(address) {
		try {
			const response = await this.axios.get(`/account/get?address=${address}`);

			return { response };
		} catch (error) {
			return axiosErrorHandler(error);
		}
	},

	/**
	 * Gets timestamp from network.
	 * @returns {Promise<object>} Timestamp.
	 */
	async getNetworkTime() {
		try {
			const response = await this.axios.get('/time-sync/network-time');
			return { response };
		} catch (error) {
			return axiosErrorHandler(error);
		}
	},

	/**
	 * Gets unconfirmed transactions from account.
	 * @param {string} address Account address.
	 * @returns {Promise<Array>} Transactions.
	 */
	async getUnconfirmedTransactions(address) {
		try {
			const response = await this.axios.get(`/account/unconfirmedTransactions?address=${address}`);
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
			const response = await this.axios.post('/transaction/announce', payload);
			return { response };
		} catch (error) {
			return axiosErrorHandler(error);
		}
	}
});

export default createNemClient;
