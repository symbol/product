import { CacheMode } from '../../src/constants';
import { RequestCache } from '../../src/lib/cache/RequestCache';
import { createJrpcCacheEntry, createUrlCacheEntry } from '../../src/lib/cache/entry';
import { jest } from '@jest/globals';

describe('RequestCache', () => {
	const nodeUrl = 'https://node.example.com:3001';
	const accountInfoUrl = `${nodeUrl}/accounts/ADDRESS`;
	const chainInfoUrl = `${nodeUrl}/chain/info`;
	const unlistedUrl = `${nodeUrl}/unlisted/path`;
	const blockScope = 'symbol:block';
	const staticScope = 'symbol:static';
	const mockResponse = { account: { balance: 100 } };

	let requestCache;
	let cachedMakeRequest;
	let makeRequest;

	const createCache = (options = {}) => {
		const entries = [
			createUrlCacheEntry({ path: '/accounts/:address', ttl: 30000, scopes: [blockScope] }),
			createUrlCacheEntry({ path: '/network/properties', ttl: 3600000, scopes: [staticScope] }),
			createUrlCacheEntry({ path: '/chain/info', mode: CacheMode.DEDUP }),
			createJrpcCacheEntry({ rpcMethod: 'eth_feeHistory', ttl: 12000, scopes: ['ethereum:block'] })
		];
		requestCache = new RequestCache(entries, options);
		cachedMakeRequest = requestCache.wrap(makeRequest);
	};

	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(1000000);
		makeRequest = jest.fn().mockResolvedValue(mockResponse);
		createCache();
	});

	afterEach(() => {
		requestCache.dispose();
		jest.useRealTimers();
	});

	it('throws when created without an entry array', () => {
		// Act & Assert:
		expect(() => new RequestCache()).toThrow(/entries/);
	});

	describe('cache mode', () => {
		it('serves repeated requests from the cache while fresh', async () => {
			// Act:
			const firstResponse = await cachedMakeRequest(accountInfoUrl);
			const secondResponse = await cachedMakeRequest(accountInfoUrl);

			// Assert:
			expect(makeRequest).toHaveBeenCalledTimes(1);
			expect(firstResponse).toBe(mockResponse);
			expect(secondResponse).toBe(mockResponse);
		});

		it('refetches after the ttl expires', async () => {
			// Arrange:
			await cachedMakeRequest(accountInfoUrl);

			// Act:
			jest.setSystemTime(1000000 + 30000);
			await cachedMakeRequest(accountInfoUrl);

			// Assert:
			expect(makeRequest).toHaveBeenCalledTimes(2);
		});

		it('caches requests to different URLs independently', async () => {
			// Act:
			await cachedMakeRequest(accountInfoUrl);
			await cachedMakeRequest(`${nodeUrl}/accounts/ANOTHER_ADDRESS`);

			// Assert:
			expect(makeRequest).toHaveBeenCalledTimes(2);
		});

		it('shares one network call between concurrent identical requests', async () => {
			// Arrange:
			let resolveRequest;
			makeRequest.mockReturnValue(new Promise(resolve => {
				resolveRequest = resolve;
			}));

			// Act:
			const firstRequest = cachedMakeRequest(accountInfoUrl);
			const secondRequest = cachedMakeRequest(accountInfoUrl);
			resolveRequest(mockResponse);
			const responses = await Promise.all([firstRequest, secondRequest]);

			// Assert:
			expect(makeRequest).toHaveBeenCalledTimes(1);
			expect(responses).toEqual([mockResponse, mockResponse]);
		});

		it('does not cache failed requests', async () => {
			// Arrange:
			makeRequest.mockRejectedValueOnce(new Error('request failed'));

			// Act & Assert:
			await expect(cachedMakeRequest(accountInfoUrl)).rejects.toThrow('request failed');
			await expect(cachedMakeRequest(accountInfoUrl)).resolves.toBe(mockResponse);
			expect(makeRequest).toHaveBeenCalledTimes(2);
		});

		it('caches a matched JSON-RPC request by method and params, ignoring the id', async () => {
			// Arrange:
			const createJrpcOptions = id => ({
				method: 'POST',
				body: JSON.stringify({
					jsonrpc: '2.0',
					id,
					method: 'eth_feeHistory',
					params: ['0xa', 'latest']
				})
			});

			// Act:
			await cachedMakeRequest(nodeUrl, createJrpcOptions(1));
			await cachedMakeRequest(nodeUrl, createJrpcOptions(2));

			// Assert:
			expect(makeRequest).toHaveBeenCalledTimes(1);
		});
	});

	describe('dedup mode', () => {
		it('shares one network call between concurrent requests without storing the response', async () => {
			// Arrange:
			let resolveRequest;
			makeRequest.mockReturnValueOnce(new Promise(resolve => {
				resolveRequest = resolve;
			}));

			// Act:
			const firstRequest = cachedMakeRequest(chainInfoUrl);
			const secondRequest = cachedMakeRequest(chainInfoUrl);
			resolveRequest(mockResponse);
			await Promise.all([firstRequest, secondRequest]);
			await cachedMakeRequest(chainInfoUrl);

			// Assert: concurrent requests are shared, but the settled response is not reused.
			expect(makeRequest).toHaveBeenCalledTimes(2);
		});
	});

	describe('unmatched requests', () => {
		it('deduplicates concurrent unmatched GET requests without caching them', async () => {
			// Act:
			await Promise.all([cachedMakeRequest(unlistedUrl), cachedMakeRequest(unlistedUrl)]);
			await cachedMakeRequest(unlistedUrl);

			// Assert:
			expect(makeRequest).toHaveBeenCalledTimes(2);
		});

		it('passes unmatched POST requests straight through', async () => {
			// Arrange:
			const options = { method: 'POST', body: '{"data":1}' };

			// Act:
			await Promise.all([cachedMakeRequest(unlistedUrl, options), cachedMakeRequest(unlistedUrl, options)]);

			// Assert:
			expect(makeRequest).toHaveBeenCalledTimes(2);
		});

		it('passes PUT requests straight through even for a listed path', async () => {
			// Arrange:
			const options = { method: 'PUT', body: '{"data":1}' };

			// Act:
			await Promise.all([cachedMakeRequest(accountInfoUrl, options), cachedMakeRequest(accountInfoUrl, options)]);

			// Assert:
			expect(makeRequest).toHaveBeenCalledTimes(2);
		});

		it('passes requests with unparseable URLs straight through', async () => {
			// Act:
			await cachedMakeRequest('not-a-url');
			await cachedMakeRequest('not-a-url');

			// Assert:
			expect(makeRequest).toHaveBeenCalledTimes(2);
		});
	});

	describe('clear()', () => {
		it('removes stored responses of the given scopes only', async () => {
			// Arrange:
			await cachedMakeRequest(accountInfoUrl);
			await cachedMakeRequest(`${nodeUrl}/network/properties`);

			// Act:
			requestCache.clear([blockScope]);
			await cachedMakeRequest(accountInfoUrl);
			await cachedMakeRequest(`${nodeUrl}/network/properties`);

			// Assert: the block-scoped response is refetched, the static-scoped one is still served from the cache.
			expect(makeRequest).toHaveBeenCalledTimes(3);
		});
	});

	describe('clearAll()', () => {
		it('removes all stored responses', async () => {
			// Arrange:
			await cachedMakeRequest(accountInfoUrl);
			await cachedMakeRequest(`${nodeUrl}/network/properties`);

			// Act:
			requestCache.clearAll();
			await cachedMakeRequest(accountInfoUrl);
			await cachedMakeRequest(`${nodeUrl}/network/properties`);

			// Assert:
			expect(makeRequest).toHaveBeenCalledTimes(4);
		});
	});

	describe('memory bounds', () => {
		it('evicts the oldest stored response at the maxEntries limit', async () => {
			// Arrange:
			createCache({ maxEntries: 2 });
			await cachedMakeRequest(`${nodeUrl}/accounts/FIRST`);
			await cachedMakeRequest(`${nodeUrl}/accounts/SECOND`);

			// Act: storing a third response evicts the first one.
			await cachedMakeRequest(`${nodeUrl}/accounts/THIRD`);
			await cachedMakeRequest(`${nodeUrl}/accounts/FIRST`);
			await cachedMakeRequest(`${nodeUrl}/accounts/THIRD`);

			// Assert: only the evicted first URL is refetched.
			expect(makeRequest).toHaveBeenCalledTimes(4);
		});

		it('sweeps expired responses and stops its timer once the store is empty', async () => {
			// Arrange:
			createCache({ sweepInterval: 60000 });
			await cachedMakeRequest(accountInfoUrl);
			expect(jest.getTimerCount()).toBe(1);

			// Act: advance past both the ttl and the sweep interval.
			jest.advanceTimersByTime(60000);

			// Assert:
			expect(jest.getTimerCount()).toBe(0);
		});

		it('stops all timers on dispose', async () => {
			// Arrange:
			await cachedMakeRequest(accountInfoUrl);

			// Act:
			requestCache.dispose();

			// Assert:
			expect(jest.getTimerCount()).toBe(0);
		});
	});
});
