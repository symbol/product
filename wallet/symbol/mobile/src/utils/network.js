import { InternalServerError, NetworkRequestError, NotFoundError, RateLimitError, InvalidRequestError } from 'wallet-common-core';


/**
 * Makes an HTTP request.
 * @param {string} url - The request URL.
 * @param {object} options - The request options.
 * @returns {Promise} The request response.
 */
export const makeRequest = async (url, options) => {
	//console.log(`[${options?.method || 'GET'}] ${url}`);
	const response = await fetch(url, options);

	if (response.ok)
		return response.json();

	let errorMessageText;
	try {
		const errorMessage = await response.json();
		errorMessageText = errorMessage.message || errorMessage.error;
	} catch {
		errorMessageText = response.statusText;
	}

	switch (response.status) {
		case 400:
		case 409:
			throw new InvalidRequestError(errorMessageText, response.status);
		case 404:
			throw new NotFoundError(errorMessageText, response.status);
		case 429:
			throw new RateLimitError(errorMessageText, response.status);
		case 500:
		case 502:
			throw new InternalServerError(errorMessageText, response.status);
		default:
			throw new NetworkRequestError(errorMessageText, response.status);
	}
};
