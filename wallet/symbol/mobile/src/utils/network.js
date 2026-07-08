import { InternalServerError, InvalidRequestError, NetworkRequestError, NotFoundError, RateLimitError } from 'wallet-common-core';

// Absolute HTTP(S) URL: an http/https scheme followed by a non-empty host.
const ABSOLUTE_HTTP_URL_PATTERN = /^https?:\/\/[^/\s]+/i;

/**
 * Checks whether a value is a well-formed absolute HTTP(S) URL, guarding the network
 * layer against empty, relative, scheme-less or otherwise malformed request targets.
 * @param {string} url - The URL to validate.
 * @returns {boolean} - Whether the URL is a valid absolute HTTP(S) URL.
 */
export const isValidRequestUrl = url => ABSOLUTE_HTTP_URL_PATTERN.test(url);

/**
 * Makes an HTTP request.
 * @param {string} url - The request URL.
 * @param {object} options - The request options.
 * @returns {Promise} The request response.
 */
export const makeRequest = async (url, options) => {
	if (!isValidRequestUrl(url))
		throw new NetworkRequestError(`Invalid request URL: "${url}"`);

	let response;

	try {
		response = await fetch(url, options);
	} catch (error) {
		// A transport-level failure (no connection, unreachable host, aborted request) rejects here
		throw new NetworkRequestError(error.message);
	}

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
