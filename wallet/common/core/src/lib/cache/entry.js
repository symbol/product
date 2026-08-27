import { CacheMode, HttpMethod } from '../../constants';

/**
 * @typedef {import('../../types/Cache').CacheEntry} CacheEntry
 * @typedef {import('../../types/Cache').CacheRequestInfo} CacheRequestInfo
 */

// Captures host, pathname and query string of an absolute HTTP(S) URL.
const URL_PARTS_PATTERN = /^https?:\/\/([^/?\s]+)([^?\s]*)\??(\S*)$/i;

const JRPC_KEY_PREFIX = 'JRPC';

/**
 * Parses a JSON request body, returning null for non-JSON payloads so that matching and key
 * building can treat them as opaque.
 * @param {string | undefined} body - The raw request body.
 * @returns {Object | null} The parsed body object or null.
 */
const parseJsonBody = body => {
	if (typeof body !== 'string')
		return null;

	try {
		const parsedBody = JSON.parse(body);

		return typeof parsedBody === 'object' ? parsedBody : null;
	} catch {
		return null;
	}
};

/**
 * Serializes a value to JSON with object keys sorted recursively, so that semantically equal
 * bodies produce equal cache keys. Array order is preserved because it can be meaningful
 * (e.g. positional JSON-RPC params).
 * @param {*} value - The value to serialize.
 * @returns {string} The canonical JSON string.
 */
const toCanonicalJson = value => {
	if (Array.isArray(value))
		return `[${value.map(toCanonicalJson).join(',')}]`;

	if (value && typeof value === 'object') {
		const sortedProperties = Object.keys(value)
			.sort()
			.map(key => `${JSON.stringify(key)}:${toCanonicalJson(value[key])}`);

		return `{${sortedProperties.join(',')}}`;
	}

	return JSON.stringify(value);
};

/**
 * Checks whether a URL path matches an express-style path pattern, where a ":param" segment
 * matches any single path segment.
 * @param {string} pathPattern - The path pattern (e.g. "/accounts/:address").
 * @param {string} pathname - The URL path to check.
 * @returns {boolean} Whether the path matches the pattern.
 */
const isPathMatchingPattern = (pathPattern, pathname) => {
	const patternSegments = pathPattern.split('/');
	const pathSegments = pathname.split('/');

	if (patternSegments.length !== pathSegments.length)
		return false;

	return patternSegments.every((patternSegment, index) => patternSegment.startsWith(':') || patternSegment === pathSegments[index]);
};

/**
 * Validates the shared caching policy fields of an entry, throwing on inconsistent combinations
 * so that configuration mistakes surface at startup rather than as silent caching bugs.
 * @param {string} mode - The caching mode.
 * @param {number | undefined} ttl - The time-to-live in milliseconds.
 * @param {string[] | undefined} scopes - The invalidation scope names.
 * @returns {void}
 */
const validateEntryPolicy = (mode, ttl, scopes) => {
	if (!Object.values(CacheMode).includes(mode))
		throw new Error(`Invalid cache entry mode: "${mode}"`);

	if (mode === CacheMode.DEDUP) {
		if (ttl !== undefined || scopes !== undefined)
			throw new Error('Dedup cache entry must not define "ttl" or "scopes"');

		return;
	}

	if (!Number.isFinite(ttl) || ttl <= 0)
		throw new Error(`Cache entry requires a positive "ttl", got: "${ttl}"`);

	if (!Array.isArray(scopes) || !scopes.length || scopes.some(scope => typeof scope !== 'string'))
		throw new Error('Cache entry requires a non-empty "scopes" array of strings');
};

/**
 * Parses a request URL and options into the request info structure used for cache entry matching
 * and key building. Returns null for URLs the cache cannot reason about (e.g. relative or
 * malformed), which callers treat as uncacheable.
 * @param {string} url - The absolute request URL.
 * @param {Object} [options] - The request options (method, body).
 * @returns {CacheRequestInfo | null} The parsed request info or null.
 */
export const parseRequest = (url, options = {}) => {
	const urlParts = URL_PARTS_PATTERN.exec(url);

	if (!urlParts)
		return null;

	const [, host, pathname, queryString] = urlParts;

	return {
		httpMethod: (options.method || HttpMethod.GET).toUpperCase(),
		host,
		pathname: pathname || '/',
		sortedQuery: queryString ? queryString.split('&').sort().join('&') : '',
		body: parseJsonBody(options.body)
	};
};

/**
 * Builds the cache key identifying a request by its method, host, path, sorted query and
 * canonicalized body. The host is included because some endpoints return node-specific data.
 * @param {CacheRequestInfo} requestInfo - The parsed request info.
 * @returns {string} The cache key.
 */
export const buildRequestKey = requestInfo => {
	const bodyKey = requestInfo.body ? toCanonicalJson(requestInfo.body) : '';

	return `${requestInfo.httpMethod}|${requestInfo.host}|${requestInfo.pathname}?${requestInfo.sortedQuery}|${bodyKey}`;
};

/**
 * Creates a cache entry matching REST requests by HTTP method and an express-style URL path
 * pattern. Query parameters do not affect matching but are part of the cache key.
 * @param {Object} options - The entry options.
 * @param {string} [options.httpMethod] - The HTTP method to match. Defaults to GET.
 * @param {string} options.path - The path pattern (e.g. "/accounts/:address").
 * @param {number} [options.ttl] - Time in milliseconds a stored response stays fresh. Cache mode only.
 * @param {string[]} [options.scopes] - Invalidation scope names. Cache mode only.
 * @param {string} [options.mode] - The caching mode. Defaults to CacheMode.CACHE.
 * @returns {CacheEntry} The cache entry.
 */
export const createUrlCacheEntry = ({ httpMethod = HttpMethod.GET, path, ttl, scopes, mode = CacheMode.CACHE }) => {
	if (typeof path !== 'string' || !path.startsWith('/'))
		throw new Error(`URL cache entry requires a "path" starting with "/", got: "${path}"`);

	validateEntryPolicy(mode, ttl, scopes);

	const normalizedHttpMethod = httpMethod.toUpperCase();

	return {
		mode,
		ttl,
		scopes,
		match: requestInfo => requestInfo.httpMethod === normalizedHttpMethod && isPathMatchingPattern(path, requestInfo.pathname),
		buildKey: buildRequestKey
	};
};

/**
 * Creates a cache entry matching JSON-RPC requests by the RPC method name. The cache key is
 * built from the RPC method and canonicalized positional params, ignoring the request "id"
 * counter so that repeated calls hit the same key.
 * @param {Object} options - The entry options.
 * @param {string} options.rpcMethod - The JSON-RPC method name to match (e.g. "eth_chainId").
 * @param {number} [options.ttl] - Time in milliseconds a stored response stays fresh. Cache mode only.
 * @param {string[]} [options.scopes] - Invalidation scope names. Cache mode only.
 * @param {string} [options.mode] - The caching mode. Defaults to CacheMode.CACHE.
 * @returns {CacheEntry} The cache entry.
 */
export const createJrpcCacheEntry = ({ rpcMethod, ttl, scopes, mode = CacheMode.CACHE }) => {
	if (typeof rpcMethod !== 'string' || !rpcMethod)
		throw new Error(`JRPC cache entry requires an "rpcMethod", got: "${rpcMethod}"`);

	validateEntryPolicy(mode, ttl, scopes);

	return {
		mode,
		ttl,
		scopes,
		match: requestInfo => requestInfo.httpMethod === HttpMethod.POST
			&& !!requestInfo.body
			&& !!requestInfo.body.jsonrpc
			&& requestInfo.body.method === rpcMethod,
		buildKey: requestInfo => {
			const paramsKey = requestInfo.body.params ? toCanonicalJson(requestInfo.body.params) : '';

			return `${JRPC_KEY_PREFIX}|${requestInfo.host}|${rpcMethod}|${paramsKey}`;
		}
	};
};
