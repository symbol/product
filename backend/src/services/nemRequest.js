const axiosRequest = require('../utils/axiosRequest');

/**
 * Handle Axios error response.
 * @param {Error} error Axios error.
 */
const axiosErrorHandler = error => {
	if (error.response) {
		// The request was made and the server responded with a status code
		// that falls out of the range of 2xx
		throw new Error(error.response.data.message);
	} else if (error.request) {
		// The request was made but no response was received
		throw new Error('node is not responding');
	} else {
		// Something happened in setting up the request that triggered an Error
		throw new Error('unable to process request');
	}
};

const nemRequest = {
	/**
	 * Gets account balance.
	 * @param {string} address Account address.
	 * @returns {Promise<object>} Account balance.
	 */
	getAccountInfo: async address => {
		try {
			const response = await axiosRequest.get(`/account/get?address=${address}`);

			return { response };
		} catch (error) {
			return axiosErrorHandler(error);
		}
	},

	/**
	 * Gets timestamp from network.
	 * @returns {Promise<object>} Timestamp.
	 */
	getNetworkTime: async () => {
		try {
			const response = await axiosRequest.get('/time-sync/network-time');
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
	getUnconfirmedTransactions: async address => {
		try {
			const response = await axiosRequest.get(`/account/unconfirmedTransactions?address=${address}`);
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
	announceTransaction: async payload => {
		try {
			const response = await axiosRequest.post('/transaction/announce', payload);
			return { response };
		} catch (error) {
			return axiosErrorHandler(error);
		}
	}
};

module.exports = nemRequest;
