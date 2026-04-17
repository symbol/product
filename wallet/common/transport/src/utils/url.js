/**
 * Safely encodes a URI component.
 * Returns the original value if encoding fails.
 *
 * @param {string} value - The value to encode
 * @returns {string} URI-encoded string, or original value if encoding fails
 */
const safeEncodeURIComponent = value => {
	try {
		return encodeURIComponent(value);
	} catch {
		return value;
	}
};

/**
 * Safely decodes a URI component.
 * Replaces '+' with space before decoding (form-encoded format).
 * Returns the original value if decoding fails.
 *
 * @param {string} value - The value to decode
 * @returns {string} Decoded string, or original value if decoding fails
 */
const safeDecodeURIComponent = value => {
	try {
		const normalizedValue = value.replace(/\+/g, ' ');
		return decodeURIComponent(normalizedValue);
	} catch {
		return value;
	}
};

/**
 * Extracts the protocol (scheme) from a URL string.
 *
 * @param {string} url - The URL to parse
 * @returns {{ protocol: string, remainingUrl: string }} Extracted protocol and remaining URL
 */
const extractProtocol = url => {
	const protocolMatch = url.match(/^([a-zA-Z][a-zA-Z0-9+\-.]*):\/\//);
	const hasProtocol = protocolMatch !== null;

	if (!hasProtocol)
		return { protocol: '', remainingUrl: url };

	const protocol = protocolMatch[1];
	const remainingUrl = url.slice(protocolMatch[0].length);

	return { protocol, remainingUrl };
};

/**
 * Removes fragment part (#...) from URL.
 *
 * @param {string} url - The URL to process
 * @returns {string} URL without fragment
 */
const removeFragment = url => {
	const fragmentIndex = url.indexOf('#');
	const hasFragment = fragmentIndex !== -1;

	if (!hasFragment)
		return url;

	return url.slice(0, fragmentIndex);
};

/**
 * Splits URL into path and query string components.
 *
 * @param {string} url - The URL to split
 * @returns {{ pathString: string, queryString: string }} Path and query string parts
 */
const splitPathAndQuery = url => {
	const queryIndex = url.indexOf('?');
	const hasQuery = queryIndex !== -1;

	if (!hasQuery)
		return { pathString: url, queryString: '' };

	return {
		pathString: url.slice(0, queryIndex),
		queryString: url.slice(queryIndex + 1)
	};
};

/**
 * Parses path string into decoded, non-empty segments.
 *
 * @param {string} pathString - The path string to parse
 * @returns {string[]} Array of decoded path segments
 */
const parsePathSegments = pathString => {
	return pathString
		.split('/')
		.filter(segment => segment.length > 0)
		.map(segment => safeDecodeURIComponent(segment));
};

/**
 * Parses query string into key-value object.
 *
 * @param {string} queryString - The query string to parse (without leading '?')
 * @returns {Object<string, string>} Decoded query parameters
 */
const parseQueryParameters = queryString => {
	const parameters = {};
	const isEmpty = !queryString;

	if (isEmpty)
		return parameters;

	const pairs = queryString.split('&');

	for (const pair of pairs) {
		const isEmptyPair = !pair;
        
		if (isEmptyPair)
			continue;

		const equalSignIndex = pair.indexOf('=');
		const hasValue = equalSignIndex !== -1;

		const rawKey = hasValue
			? pair.slice(0, equalSignIndex)
			: pair;

		const rawValue = hasValue
			? pair.slice(equalSignIndex + 1)
			: '';

		const decodedKey = safeDecodeURIComponent(rawKey);
		const decodedValue = safeDecodeURIComponent(rawValue);
		const isEmptyKey = !decodedKey;

		if (isEmptyKey)
			continue;

		parameters[decodedKey] = decodedValue;
	}

	return parameters;
};

/**
 * @typedef {Object} UrlParts
 * @property {string} protocol - URL protocol (scheme), e.g., 'web+symbol'
 * @property {string[]} pathSegments - URI-decoded non-empty path segments
 * @property {Object<string, string>} queryParameters - URI-decoded query parameters
 */

/**
 * Extracts protocol, path segments, and query parameters from a URL string.
 *
 * @param {string} url - The URL string to parse
 * @returns {UrlParts} Parsed URL components
 * @throws {Error} If url is not a non-empty string
 */
export const extractUrlParts = url => {
	const isInvalidUrl =
        typeof url !== 'string' || url.trim().length === 0;

	if (isInvalidUrl)
		throw new Error('URL must be a non-empty string');

	const trimmedUrl = url.trim();

	const { protocol, remainingUrl } = extractProtocol(trimmedUrl);
	const urlWithoutFragment = removeFragment(remainingUrl);
	const { pathString, queryString } =
        splitPathAndQuery(urlWithoutFragment);

	const pathSegments = parsePathSegments(pathString);
	const queryParameters = parseQueryParameters(queryString);

	return {
		protocol,
		pathSegments,
		queryParameters
	};
};

/**
 * Encodes an object of key-value pairs into a URL query string.
 * Does not use the URL class for React Native compatibility.
 *
 * @param {Object<string, *>} parameters - Key-value pairs to encode
 * @returns {string} URL-encoded query string (without leading '?')
 * @throws {Error} If parameters is not a non-null object
 */
export const encodeQueryParameters = parameters => {
	const isInvalidParameters =
        parameters === null ||
        parameters === undefined ||
        typeof parameters !== 'object' ||
        Array.isArray(parameters);

	if (isInvalidParameters)
		throw new Error('Parameters must be a non-null object');

	const encodedPairs = [];

	for (const [key, value] of Object.entries(parameters)) {
		const encodedKey = safeEncodeURIComponent(String(key));
		const encodedValue = safeEncodeURIComponent(String(value ?? ''));
		const isEmptyKey = encodedKey.length === 0;

		if (isEmptyKey)
			continue;

		encodedPairs.push(`${encodedKey}=${encodedValue}`);
	}

	return encodedPairs.join('&');
};
