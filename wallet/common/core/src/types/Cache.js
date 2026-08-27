/**
 * @typedef {Object} CacheRequestInfo
 * Parsed identity of an outgoing HTTP request, used for cache entry matching and cache key building.
 * @property {string} httpMethod - HTTP method in upper case.
 * @property {string} host - Host part of the URL, including the port when present.
 * @property {string} pathname - URL path without the query string.
 * @property {string} sortedQuery - Query string with parameters sorted alphabetically.
 * @property {Object | null} body - Parsed JSON request body, or null when absent or not JSON.
 */

/**
 * @typedef {Object} CacheEntry
 * A caching policy rule. The first entry matching a request defines how its response is cached.
 * @property {string} mode - Caching mode. One of the CacheMode values.
 * @property {number} [ttl] - Time in milliseconds a stored response stays fresh. Cache mode only.
 * @property {string[]} [scopes] - Invalidation scope names the stored response belongs to. Cache mode only.
 * @property {function(CacheRequestInfo): boolean} match - Returns whether a parsed request is covered by this entry.
 * @property {function(CacheRequestInfo): string} buildKey - Builds the cache key for a matched request.
 */

export default {};
