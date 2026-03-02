import { InternalServerError, InvalidRequestError, NetworkRequestError, NotFoundError, RateLimitError } from 'wallet-common-core';


/**
 * Makes an HTTP request.
 * @param {string} url - The request URL.
 * @param {object} options - The request options.
 * @returns {Promise} The request response.
 */
export const makeRequest = async (url, options) => {
	const response = await fetch(url, options);

	const rawText = await response.text();

	let jsonData;

	let errorMessageText;

	try {
		jsonData = JSON.parse(rawText);
	} catch {}

	if (response.ok && jsonData)
		return jsonData;

	if (!response.ok && jsonData)
		errorMessageText = jsonData.message || jsonData.error;

	if (!response.ok && !errorMessageText)
		errorMessageText = response.statusText;

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
