import { buildRequestKey, parseRequest } from './entry';
import { CacheMode, HttpMethod } from '../../constants';

/**
 * @typedef {import('../../types/Cache').CacheEntry} CacheEntry
 */

const DEFAULT_MAX_ENTRIES = 300;
const DEFAULT_SWEEP_INTERVAL = 60000;

/**
 * TTL cache and in-flight deduplicator for read requests, driven by an allowlist of cache
 * entries. Requests matching a cache-mode entry are served from memory while fresh; concurrent
 * identical requests share one network call. Unmatched GET requests are deduplicated only, and
 * unmatched non-GET requests (writes) are always passed straight through, so they can never be
 * cached by configuration mistake. Staleness is enforced at read time; the periodic sweep and
 * the entry limit only bound memory usage.
 */
export class RequestCache {
	#entries;

	#store = new Map();

	#inflightRequests = new Map();

	#maxEntries;

	#sweepInterval;

	#sweepTimer = null;

	/**
	 * Creates a request cache.
	 * @param {CacheEntry[]} entries - The cache entries. The first entry matching a request wins.
	 * @param {Object} [options] - The cache options.
	 * @param {number} [options.maxEntries] - Maximum number of stored responses before the oldest is evicted.
	 * @param {number} [options.sweepInterval] - Interval in milliseconds between expired-value sweeps.
	 */
	constructor(entries, options = {}) {
		if (!Array.isArray(entries))
			throw new Error('RequestCache requires an array of cache entries');

		this.#entries = entries;
		this.#maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
		this.#sweepInterval = options.sweepInterval ?? DEFAULT_SWEEP_INTERVAL;
	}

	/**
	 * Wraps a request function with caching and deduplication. The returned function has the
	 * same signature and error behavior, so callers do not need to change.
	 * @param {function} makeRequest - The request function to wrap.
	 * @returns {function(string, Object): Promise} The wrapped request function.
	 */
	wrap(makeRequest) {
		return (url, options) => {
			const requestInfo = parseRequest(url, options);
			const entry = requestInfo && this.#entries.find(cacheEntry => cacheEntry.match(requestInfo));

			if (!entry) {
				const isUnmatchedGet = requestInfo && requestInfo.httpMethod === HttpMethod.GET;

				if (!isUnmatchedGet)
					return makeRequest(url, options);

				return this.#requestDeduplicated(buildRequestKey(requestInfo), () => makeRequest(url, options), null);
			}

			const key = entry.buildKey(requestInfo);

			if (entry.mode === CacheMode.DEDUP)
				return this.#requestDeduplicated(key, () => makeRequest(url, options), null);

			const storedValue = this.#getFreshValue(key);

			if (storedValue !== undefined)
				return Promise.resolve(storedValue);

			return this.#requestDeduplicated(key, () => makeRequest(url, options), entry);
		};
	}

	/**
	 * Removes all stored responses belonging to any of the given scopes. In-flight requests are
	 * left to settle: their responses carry data fetched after the invalidating event anyway.
	 * @param {string[]} scopes - The scope names to invalidate.
	 * @returns {void}
	 */
	clear(scopes) {
		for (const [key, storedEntry] of this.#store) {
			if (storedEntry.scopes.some(scope => scopes.includes(scope)))
				this.#store.delete(key);
		}
	}

	/**
	 * Removes all stored responses.
	 * @returns {void}
	 */
	clearAll() {
		this.#store.clear();
	}

	/**
	 * Stops the sweep timer and drops all cache state. Intended for teardown in tests.
	 * @returns {void}
	 */
	dispose() {
		this.#stopSweepTimer();
		this.#store.clear();
		this.#inflightRequests.clear();
	}

	/**
	 * Executes a request through the in-flight map, so that concurrent identical requests share one network call.
	 * @param {string} key - The cache key.
	 * @param {function} requestFn - The function performing the network request.
	 * @param {CacheEntry | null} entry - The matched cache entry, or null when only deduplication applies.
	 * @returns {Promise} The request result.
	 */
	#requestDeduplicated(key, requestFn, entry) {
		const inflightRequest = this.#inflightRequests.get(key);

		if (inflightRequest)
			return inflightRequest;

		const requestPromise = requestFn().then(
			value => {
				this.#inflightRequests.delete(key);

				// Only truthy responses are stored — failures and empty payloads must not mask real data.
				if (entry && value)
					this.#storeValue(key, value, entry);

				return value;
			},
			error => {
				this.#inflightRequests.delete(key);

				throw error;
			}
		);

		this.#inflightRequests.set(key, requestPromise);

		return requestPromise;
	}

	/**
	 * Returns the stored response for a key while it is fresh, removing it once expired.
	 * @param {string} key - The cache key.
	 * @returns {*} The stored value, or undefined when absent or expired.
	 */
	#getFreshValue(key) {
		const storedEntry = this.#store.get(key);

		if (!storedEntry)
			return undefined;

		if (Date.now() >= storedEntry.expiresAt) {
			this.#store.delete(key);

			return undefined;
		}

		return storedEntry.value;
	}

	/**
	 * Stores a response value with its expiry and scopes, evicting the oldest entry at capacity.
	 * @param {string} key - The cache key.
	 * @param {*} value - The response value.
	 * @param {CacheEntry} entry - The matched cache entry providing ttl and scopes.
	 * @returns {void}
	 */
	#storeValue(key, value, entry) {
		if (this.#store.size >= this.#maxEntries && !this.#store.has(key)) {
			const oldestKey = this.#store.keys().next().value;
			this.#store.delete(oldestKey);
		}

		this.#store.set(key, {
			value,
			expiresAt: Date.now() + entry.ttl,
			scopes: entry.scopes
		});
		this.#startSweepTimer();
	}

	/**
	 * Removes expired responses, stopping the sweep timer when the store is empty.
	 * @returns {void}
	 */
	#removeExpiredValues() {
		const now = Date.now();

		for (const [key, storedEntry] of this.#store) {
			if (now >= storedEntry.expiresAt)
				this.#store.delete(key);
		}

		if (!this.#store.size)
			this.#stopSweepTimer();
	}

	/**
	 * Starts the periodic expired-value sweep if it is not already running.
	 * @returns {void}
	 */
	#startSweepTimer() {
		if (this.#sweepTimer)
			return;

		this.#sweepTimer = setInterval(() => this.#removeExpiredValues(), this.#sweepInterval);
	}

	/**
	 * Stops the periodic expired-value sweep.
	 * @returns {void}
	 */
	#stopSweepTimer() {
		if (!this.#sweepTimer)
			return;

		clearInterval(this.#sweepTimer);
		this.#sweepTimer = null;
	}
}
