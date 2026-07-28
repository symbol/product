import config from '@/config';
import axios from 'axios';

/**
 * Options for a GET request.
 * @typedef {Object} GetRequestOptions
 * @property {number} [timeout=config.PUBLIC_REQUEST_TIMEOUT] Request timeout in milliseconds.
 * @property {AbortSignal} [signal] Signal used to cancel the request.
 */

/**
 * Sends a GET request and returns the response body.
 * @param {string} url Request URL.
 * @param {GetRequestOptions} [options={}] GET request options.
 * @returns {Promise<*>} Response body returned by the endpoint.
 */
export const makeGetRequest = async (url, options = {}) => {
	const { timeout = config.PUBLIC_REQUEST_TIMEOUT, signal } = options;
	const response = await axios.get(url, { signal, timeout });

	return response.data;
};
