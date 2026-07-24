import { CacheMode, HttpMethod } from '../../src/constants';
import { buildRequestKey, createJrpcCacheEntry, createUrlCacheEntry, parseRequest } from '../../src/lib/cache/entry';

describe('cache entry', () => {
	const nodeUrl = 'https://node.example.com:3001';

	describe('parseRequest()', () => {
		const runParseRequestTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const requestInfo = parseRequest(config.url, config.options);

				// Assert:
				expect(requestInfo).toEqual(expected.requestInfo);
			});
		};

		runParseRequestTest(
			'parses a GET request URL into method, host, path and query',
			{ url: `${nodeUrl}/accounts/ADDRESS?pageSize=10&order=desc` },
			{
				requestInfo: {
					httpMethod: HttpMethod.GET,
					host: 'node.example.com:3001',
					pathname: '/accounts/ADDRESS',
					sortedQuery: 'order=desc&pageSize=10',
					body: null
				}
			}
		);

		runParseRequestTest(
			'defaults the path to "/" for a bare host URL',
			{ url: 'https://node.example.com' },
			{
				requestInfo: {
					httpMethod: HttpMethod.GET,
					host: 'node.example.com',
					pathname: '/',
					sortedQuery: '',
					body: null
				}
			}
		);

		runParseRequestTest(
			'parses a JSON body and upper-cases the method',
			{ url: `${nodeUrl}/namespaces/names`, options: { method: 'post', body: '{"namespaceIds":["A1"]}' } },
			{
				requestInfo: {
					httpMethod: HttpMethod.POST,
					host: 'node.example.com:3001',
					pathname: '/namespaces/names',
					sortedQuery: '',
					body: { namespaceIds: ['A1'] }
				}
			}
		);

		runParseRequestTest(
			'treats a non-JSON body as absent',
			{ url: `${nodeUrl}/path`, options: { method: 'POST', body: 'plain-text' } },
			{
				requestInfo: {
					httpMethod: HttpMethod.POST,
					host: 'node.example.com:3001',
					pathname: '/path',
					sortedQuery: '',
					body: null
				}
			}
		);

		runParseRequestTest('returns null for a relative URL', { url: '/accounts/ADDRESS' }, { requestInfo: null });

		runParseRequestTest('returns null for a non-HTTP URL', { url: 'wss://node.example.com/ws' }, { requestInfo: null });
	});

	describe('buildRequestKey()', () => {
		it('builds equal keys for equal requests with different query parameter order', () => {
			// Arrange:
			const firstRequestInfo = parseRequest(`${nodeUrl}/namespaces?pageSize=10&order=desc`);
			const secondRequestInfo = parseRequest(`${nodeUrl}/namespaces?order=desc&pageSize=10`);

			// Act & Assert:
			expect(buildRequestKey(firstRequestInfo)).toBe(buildRequestKey(secondRequestInfo));
		});

		it('builds equal keys for equal bodies with different property order', () => {
			// Arrange:
			const firstRequestInfo = parseRequest(nodeUrl, { method: 'POST', body: '{"a":1,"b":{"d":4,"c":3}}' });
			const secondRequestInfo = parseRequest(nodeUrl, { method: 'POST', body: '{"b":{"c":3,"d":4},"a":1}' });

			// Act & Assert:
			expect(buildRequestKey(firstRequestInfo)).toBe(buildRequestKey(secondRequestInfo));
		});

		it('builds different keys for different hosts, paths and bodies', () => {
			// Arrange:
			const baseRequestInfo = parseRequest(`${nodeUrl}/mosaics`, { method: 'POST', body: '{"mosaicIds":["A1"]}' });
			const differentRequestInfos = [
				parseRequest('https://other-node.example.com/mosaics', { method: 'POST', body: '{"mosaicIds":["A1"]}' }),
				parseRequest(`${nodeUrl}/namespaces`, { method: 'POST', body: '{"mosaicIds":["A1"]}' }),
				parseRequest(`${nodeUrl}/mosaics`, { method: 'POST', body: '{"mosaicIds":["B2"]}' })
			];

			// Act & Assert:
			differentRequestInfos.forEach(differentRequestInfo => {
				expect(buildRequestKey(differentRequestInfo)).not.toBe(buildRequestKey(baseRequestInfo));
			});
		});
	});

	describe('createUrlCacheEntry()', () => {
		describe('validation', () => {
			const runValidationTest = (description, config) => {
				it(description, () => {
					// Act & Assert:
					expect(() => createUrlCacheEntry(config.options)).toThrow(config.expectedError);
				});
			};

			runValidationTest('throws when path is missing', { options: { ttl: 1000, scopes: ['scope'] }, expectedError: /path/ });

			runValidationTest(
				'throws when path does not start with a slash',
				{ options: { path: 'accounts', ttl: 1000, scopes: ['scope'] }, expectedError: /path/ }
			);

			runValidationTest(
				'throws for an unknown mode',
				{ options: { path: '/accounts', ttl: 1000, scopes: ['scope'], mode: 'unknown' }, expectedError: /mode/ }
			);

			runValidationTest(
				'throws for cache mode without ttl',
				{ options: { path: '/accounts', scopes: ['scope'] }, expectedError: /ttl/ }
			);

			runValidationTest(
				'throws for cache mode without scopes',
				{ options: { path: '/accounts', ttl: 1000 }, expectedError: /scopes/ }
			);

			runValidationTest(
				'throws for cache mode with empty scopes',
				{ options: { path: '/accounts', ttl: 1000, scopes: [] }, expectedError: /scopes/ }
			);

			runValidationTest(
				'throws for dedup mode with ttl',
				{ options: { path: '/accounts', ttl: 1000, mode: CacheMode.DEDUP }, expectedError: /ttl/ }
			);
		});

		describe('match()', () => {
			const entry = createUrlCacheEntry({ path: '/accounts/:address/multisig', ttl: 1000, scopes: ['scope'] });

			const runMatchTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const requestInfo = parseRequest(config.url, config.options);

					// Act & Assert:
					expect(entry.match(requestInfo)).toBe(expected.isMatch);
				});
			};

			runMatchTest(
				'matches a URL with any parameter segment value',
				{ url: `${nodeUrl}/accounts/ADDRESS/multisig` },
				{ isMatch: true }
			);

			runMatchTest(
				'matches regardless of query parameters',
				{ url: `${nodeUrl}/accounts/ADDRESS/multisig?pageSize=10` },
				{ isMatch: true }
			);

			runMatchTest('does not match a different static segment', { url: `${nodeUrl}/accounts/ADDRESS/info` }, { isMatch: false });

			runMatchTest('does not match a shorter path', { url: `${nodeUrl}/accounts/ADDRESS` }, { isMatch: false });

			runMatchTest('does not match a longer path', { url: `${nodeUrl}/accounts/ADDRESS/multisig/extra` }, { isMatch: false });

			runMatchTest(
				'does not match a different HTTP method',
				{ url: `${nodeUrl}/accounts/ADDRESS/multisig`, options: { method: 'POST' } },
				{ isMatch: false }
			);
		});

		it('defaults to cache mode', () => {
			// Act:
			const entry = createUrlCacheEntry({ path: '/accounts', ttl: 1000, scopes: ['scope'] });

			// Assert:
			expect(entry.mode).toBe(CacheMode.CACHE);
		});

		it('creates a dedup entry without ttl and scopes', () => {
			// Act:
			const entry = createUrlCacheEntry({ path: '/chain/info', mode: CacheMode.DEDUP });

			// Assert:
			expect(entry.mode).toBe(CacheMode.DEDUP);
		});
	});

	describe('createJrpcCacheEntry()', () => {
		const entry = createJrpcCacheEntry({ rpcMethod: 'eth_feeHistory', ttl: 1000, scopes: ['scope'] });

		const createJrpcRequestInfo = body => parseRequest(nodeUrl, { method: 'POST', body: JSON.stringify(body) });

		it('throws when rpcMethod is missing', () => {
			// Act & Assert:
			expect(() => createJrpcCacheEntry({ ttl: 1000, scopes: ['scope'] })).toThrow(/rpcMethod/);
		});

		describe('match()', () => {
			it('matches a JSON-RPC request with the configured method', () => {
				// Arrange:
				const requestInfo = createJrpcRequestInfo({ jsonrpc: '2.0', id: 1, method: 'eth_feeHistory', params: [] });

				// Act & Assert:
				expect(entry.match(requestInfo)).toBe(true);
			});

			it('does not match a different JSON-RPC method', () => {
				// Arrange:
				const requestInfo = createJrpcRequestInfo({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] });

				// Act & Assert:
				expect(entry.match(requestInfo)).toBe(false);
			});

			it('does not match a plain JSON POST without a jsonrpc envelope', () => {
				// Arrange:
				const requestInfo = createJrpcRequestInfo({ method: 'eth_feeHistory' });

				// Act & Assert:
				expect(entry.match(requestInfo)).toBe(false);
			});

			it('does not match a GET request', () => {
				// Arrange:
				const requestInfo = parseRequest(`${nodeUrl}/eth_feeHistory`);

				// Act & Assert:
				expect(entry.match(requestInfo)).toBe(false);
			});
		});

		describe('buildKey()', () => {
			it('ignores the request id', () => {
				// Arrange:
				const firstRequestInfo = createJrpcRequestInfo({ jsonrpc: '2.0', id: 1, method: 'eth_feeHistory', params: ['0xa'] });
				const secondRequestInfo = createJrpcRequestInfo({ jsonrpc: '2.0', id: 42, method: 'eth_feeHistory', params: ['0xa'] });

				// Act & Assert:
				expect(entry.buildKey(firstRequestInfo)).toBe(entry.buildKey(secondRequestInfo));
			});

			it('preserves positional param order', () => {
				// Arrange:
				const firstRequestInfo = createJrpcRequestInfo({
					jsonrpc: '2.0',
					id: 1,
					method: 'eth_feeHistory',
					params: ['0xa', 'latest']
				});
				const secondRequestInfo = createJrpcRequestInfo({
					jsonrpc: '2.0',
					id: 1,
					method: 'eth_feeHistory',
					params: ['latest', '0xa']
				});

				// Act & Assert:
				expect(entry.buildKey(firstRequestInfo)).not.toBe(entry.buildKey(secondRequestInfo));
			});
		});
	});
});
