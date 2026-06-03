import { BLOCK_GENERATION_TARGET_TIME, NetworkIdentifier, NetworkType } from '../constants';

/**
 * Converts a NEM network type byte to a network identifier string.
 * @param {number} networkType - The network type (104 for mainnet, 152 for testnet).
 * @returns {string} The network identifier.
 */
export const networkTypeToIdentifier = networkType => {
	if (networkType === NetworkType.MAIN_NET)
		return NetworkIdentifier.MAIN_NET;

	if (networkType === NetworkType.TEST_NET)
		return NetworkIdentifier.TEST_NET;

	throw new Error(`Unsupported network type "${networkType}"`);
};

/**
 * Converts a network identifier string to a NEM network type byte.
 * @param {string} networkIdentifier - The network identifier.
 * @returns {number} The network type byte.
 */
export const networkIdentifierToNetworkType = networkIdentifier => {
	if (networkIdentifier === NetworkIdentifier.MAIN_NET)
		return NetworkType.MAIN_NET;

	if (networkIdentifier === NetworkIdentifier.TEST_NET)
		return NetworkType.TEST_NET;

	throw new Error(`Unsupported network identifier "${networkIdentifier}"`);
};

/**
 * Parses the block generation target time in seconds.
 * Falls back to the NEM1 protocol constant when no value is provided.
 * @param {number|string} value - The raw block generation target time value.
 * @returns {number} The time in seconds.
 */
export const parseBlockGenerationTargetTime = value => {
	if (!value)
		return BLOCK_GENERATION_TARGET_TIME;

	return typeof value === 'string' ? parseInt(value) : value;
};

/**
 * Builds a URL with query parameters.
 * @param {string} baseUrl - The base node URL.
 * @param {string} path - The API path.
 * @param {object} searchCriteria - The search criteria appended as query parameters.
 * @param {object} [additionalConditions] - Additional query parameters to include.
 * @returns {string} The constructed search URL.
 */
export const createSearchUrl = (baseUrl, path, searchCriteria, additionalConditions = {}) => {
	const params = new URLSearchParams({
		...searchCriteria,
		...additionalConditions
	});

	return `${baseUrl}${path}?${params.toString()}`;
};
