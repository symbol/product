/** @typedef {import('../types/SearchCriteria').SortableSearchCriteria} SortableSearchCriteria */

/**
 * Formats a number to a fixed number of digits.
 * @param {number} num - The number.
 * @param {number} digits - The number of digits.
 * @returns {number} The formatted number.
 */
export const toFixedNumber = (num, digits) => {
	const power = Math.pow(10, digits);

	return Math.round(num * power) / power;
};

/**
 * Formats a number to a fixed numeric string. Ensures correct decimal placement and zero-padding.
 * @param {number} num - The number.
 * @param {number} divisibility - The divisibility.
 * @returns {string} The formatted numeric string.
 */
export const toFixedNumericString = (num, divisibility) => {
	if (divisibility === 0) 
		return num.toString();

	return num.toFixed(divisibility);
};

/**
 * Converts a chain timestamp to a Unix timestamp.
 * @param {number} timestamp - The chain timestamp.
 * @param {number} epochAdjustment - The epoch adjustment.
 * @returns {string} The converted timestamp in milliseconds.
 */
export const networkTimestampToUnix = (timestamp, epochAdjustment) =>
	Number(timestamp) + (epochAdjustment * 1000);

/**
 * Returns a promise that resolves when all promises are settled.
 * Polyfill for Promise.allSettled.
 * @param {Array} promises - The array of promises.
 * @returns {Promise} The promise that resolves when all promises are settled.
 */
export const promiseAllSettled = promises => {
	if (typeof Promise.allSettled === 'function')
		return Promise.allSettled(promises);
	
	return Promise.all(promises.map(p =>
		p
			.then(value => ({ status: 'fulfilled', value }))
			.catch(reason => ({ status: 'rejected', reason }))));
};

/**
 * Creates a search URL with pagination and additional parameters.
 * @param {string} nodeUrl - The node URL.
 * @param {string} path - The API path.
 * @param {SortableSearchCriteria} [searchCriteria] - The search criteria containing pageNumber, pageSize, and order.
 * @param {object} [additionalParams] - Additional parameters to include in the search URL.
 * @returns {string} The constructed search URL.
 */
export const createSearchUrl = (nodeUrl, path, searchCriteria = {}, additionalParams = {}) => {
	const appendParameter = (url, key, value) => {
		return `${url}${url.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(value)}`;
	};
	
	const { pageNumber = 1, pageSize = 100, order = 'desc' } = searchCriteria;
	let url = `${nodeUrl}${path}`;

	// Set the search parameters
	url = appendParameter(url, 'pageNumber', pageNumber);
	url = appendParameter(url, 'pageSize', pageSize);
	url = appendParameter(url, 'order', order);

	// Append additional parameters as query parameters
	Object.entries(additionalParams).forEach(([key, value]) => {
		url = appendParameter(url, key, value);
	});

	return url;
};
