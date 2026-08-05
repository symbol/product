import { isValidRequestUrl, makeRequest } from '@/app/utils/network';
import { InternalServerError, InvalidRequestError, NetworkRequestError, NotFoundError, RateLimitError } from 'wallet-common-core';

describe('utils/network', () => {
	const createMockResponse = (ok, status, body, statusText = 'Error') => ({
		ok,
		status,
		statusText,
		json: jest.fn().mockResolvedValue(body),
		text: jest.fn().mockResolvedValue(JSON.stringify(body))
	});

	const createMockErrorResponse = (status, errorBody, statusText = 'Error') =>
		createMockResponse(false, status, errorBody, statusText);

	beforeEach(() => {
		global.fetch = jest.fn();
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	describe('makeRequest', () => {
		describe('successful response', () => {
			it('returns parsed JSON when response is ok', async () => {
				// Arrange:
				const expectedData = { data: 'test' };
				global.fetch.mockResolvedValue(createMockResponse(true, 200, expectedData));

				// Act:
				const result = await makeRequest('https://example.com', {});

				// Assert:
				expect(result).toEqual(expectedData);
				expect(global.fetch).toHaveBeenCalledWith('https://example.com', {});
			});
		});

		describe('invalid request URL', () => {
			const runInvalidUrlTest = (description, url) => {
				it(description, async () => {
					// Act & Assert:
					await expect(makeRequest(url, {})).rejects.toThrow(NetworkRequestError);
					expect(global.fetch).not.toHaveBeenCalled();
				});
			};

			runInvalidUrlTest('throws NetworkRequestError without calling fetch when the URL host is undefined', 'undefined/accounts/abc');
			runInvalidUrlTest('throws NetworkRequestError without calling fetch when the URL is empty', '');
			runInvalidUrlTest('throws NetworkRequestError without calling fetch when the URL is relative', '/accounts/abc');
		});

		describe('error responses', () => {
			const runErrorResponseTest = (description, config, expected) => {
				it(description, async () => {
					// Arrange:
					global.fetch.mockResolvedValue(createMockErrorResponse(config.status, config.errorBody));

					// Act & Assert:
					await expect(makeRequest('https://example.com', {})).rejects.toThrow(expected.errorType);
				});
			};

			const tests = [
				{
					description: 'throws InvalidRequestError for status 400',
					config: { status: 400, errorBody: { message: 'Bad Request' } },
					expected: { errorType: InvalidRequestError }
				},
				{
					description: 'throws InvalidRequestError for status 409',
					config: { status: 409, errorBody: { message: 'Conflict' } },
					expected: { errorType: InvalidRequestError }
				},
				{
					description: 'throws NotFoundError for status 404',
					config: { status: 404, errorBody: { message: 'Not Found' } },
					expected: { errorType: NotFoundError }
				},
				{
					description: 'throws RateLimitError for status 429',
					config: { status: 429, errorBody: { message: 'Too Many Requests' } },
					expected: { errorType: RateLimitError }
				},
				{
					description: 'throws InternalServerError for status 500',
					config: { status: 500, errorBody: { message: 'Internal Server Error' } },
					expected: { errorType: InternalServerError }
				},
				{
					description: 'throws InternalServerError for status 502',
					config: { status: 502, errorBody: { message: 'Bad Gateway' } },
					expected: { errorType: InternalServerError }
				},
				{
					description: 'throws NetworkRequestError for status 503',
					config: { status: 503, errorBody: { message: 'Service Unavailable' } },
					expected: { errorType: NetworkRequestError }
				}
			];

			tests.forEach(test => {
				runErrorResponseTest(test.description, test.config, test.expected);
			});
		});

		describe('transport failures', () => {
			it('throws a coded NetworkRequestError when fetch rejects at the transport level', async () => {
				// Arrange:
				global.fetch.mockRejectedValue(new TypeError('Network request failed'));

				// Act & Assert:
				await expect(makeRequest('https://example.com', {})).rejects.toMatchObject({
					name: 'NetworkRequestError',
					code: 'error_network_request_error'
				});
			});
		});

		describe('error message extraction', () => {
			const runErrorMessageTest = (description, config, expected) => {
				it(description, async () => {
					// Arrange:
					global.fetch.mockResolvedValue(createMockErrorResponse(config.status, config.errorBody));

					// Act & Assert:
					await expect(makeRequest('https://example.com', {})).rejects.toThrow(expected.message);
				});
			};

			const tests = [
				{
					description: 'extracts error message from message property',
					config: {
						status: 400,
						errorBody: { message: 'validation failed' }
					},
					expected: { message: 'validation failed' }
				},
				{
					description: 'extracts error message from error property',
					config: {
						status: 400,
						errorBody: { error: 'invalid input' }
					},
					expected: { message: 'invalid input' }
				}
			];

			tests.forEach(test => {
				runErrorMessageTest(test.description, test.config, test.expected);
			});

			it('keeps the parsed response body on the thrown error', async () => {
				// Arrange:
				const errorBody = {
					errorCode: 'REQUEST_LIMIT_EXCEEDED',
					error: 'gross transfer amount 105666666 exceeds max transfer amount 105666660'
				};
				global.fetch.mockResolvedValue(createMockErrorResponse(400, errorBody));

				// Act & Assert:
				await expect(makeRequest('https://example.com', {})).rejects.toMatchObject({
					code: 'error_fetch_invalid_request',
					statusCode: 400,
					body: errorBody
				});
			});

			it('sets the body to null when the response is not JSON', async () => {
				// Arrange:
				global.fetch.mockResolvedValue({
					ok: false,
					status: 400,
					statusText: 'Bad Request',
					text: jest.fn().mockResolvedValue('<html>Bad Request</html>')
				});

				// Act & Assert:
				await expect(makeRequest('https://example.com', {})).rejects.toMatchObject({ body: null });
			});

			it('falls back to statusText when JSON parsing fails', async () => {
				// Arrange:
				const mockResponse = createMockResponse(
					false,
					400,
					'Invalid JSON Body',
					'Bad Request'
				);
				global.fetch.mockResolvedValue(mockResponse);

				// Act & Assert:
				await expect(makeRequest('https://example.com', {})).rejects.toThrow('Bad Request');
			});
		});

		describe('request options', () => {
			const runRequestOptionsTest = (description, config, expected) => {
				it(description, async () => {
					// Arrange:
					global.fetch.mockResolvedValue(createMockResponse(true, 200, {}));

					// Act:
					await makeRequest(config.url, config.options);

					// Assert:
					expect(global.fetch).toHaveBeenCalledWith(expected.url, expected.options);
				});
			};

			const tests = [
				{
					description: 'passes GET request options to fetch',
					config: {
						url: 'https://api.example.com/data',
						options: { method: 'GET' }
					},
					expected: { url: 'https://api.example.com/data', options: { method: 'GET' } }
				},
				{
					description: 'passes POST request with body to fetch',
					config: {
						url: 'https://api.example.com/submit',
						options: { method: 'POST', body: JSON.stringify({ key: 'value' }) }
					},
					expected: { url: 'https://api.example.com/submit', options: { method: 'POST', body: JSON.stringify({ key: 'value' }) } }
				},
				{
					description: 'passes request with headers to fetch',
					config: {
						url: 'https://api.example.com/auth',
						options: { headers: { Authorization: 'Bearer token' } }
					},
					expected: { url: 'https://api.example.com/auth', options: { headers: { Authorization: 'Bearer token' } } }
				}
			];

			tests.forEach(test => {
				runRequestOptionsTest(test.description, test.config, test.expected);
			});
		});
	});

	describe('isValidRequestUrl', () => {
		const runIsValidRequestUrlTest = (description, url, expectedResult) => {
			it(description, () => {
				// Act:
				const result = isValidRequestUrl(url);

				// Assert:
				expect(result).toBe(expectedResult);
			});
		};

		const tests = [
			// Valid absolute HTTP(S) URLs
			{ 
				description: 'returns true for an http URL', 
				url: 'http://node.testnet.com', 
				expected: true 
			},
			{ 
				description: 'returns true for an https URL', 
				url: 'https://node.testnet.com', 
				expected: true 
			},
			{ 
				description: 'returns true for a URL with a port', 
				url: 'https://node.testnet.com:3000', 
				expected: true 
			},
			{ 
				description: 'returns true for a URL with a path', 
				url: 'https://node.testnet.com/accounts/abc', 
				expected: true 
			},
			{ 
				description: 'returns true for a URL with a query string', 
				url: 'https://node.testnet.com/tx?page=1', 
				expected: true 
			},
			{ 
				description: 'returns true for an uppercase scheme', 
				url: 'HTTPS://NODE.TESTNET.COM', 
				expected: true 
			},
			{ 
				description: 'returns true for an IP address host with a port', 
				url: 'http://192.168.0.1:8080/chain/info', 
				expected: true 
			},

			// Empty and nullish values
			{ 
				description: 'returns false for an empty string', 
				url: '', 
				expected: false 
			},
			{ 
				description: 'returns false for a null value', 
				url: null, 
				expected: false 
			},
			{ 
				description: 'returns false for an undefined value', 
				url: undefined, 
				expected: false 
			},

			// Malformed values produced by interpolating a missing host
			{ 
				description: 'returns false for an undefined host from interpolation', 
				url: 'undefined/accounts/abc', 
				expected: false 
			},
			{ 
				description: 'returns false for a null host from interpolation', 
				url: 'null/accounts/abc', 
				expected: false 
			},

			// Missing or wrong scheme
			{ 
				description: 'returns false for a relative path', 
				url: '/accounts/abc', 
				expected: false 
			},
			{ 
				description: 'returns false for a bare relative path', 
				url: 'accounts/abc', 
				expected: false 
			},
			{ 
				description: 'returns false for a scheme-less host', 
				url: 'node.testnet.com/accounts/abc', 
				expected: false 
			},
			{ 
				description: 'returns false for a non-http scheme', 
				url: 'ftp://node.testnet.com', 
				expected: false 
			},
			{ 
				description: 'returns false for a websocket scheme', 
				url: 'ws://node.testnet.com', 
				expected: false 
			},
			{ 
				description: 'returns false for a protocol-relative URL', 
				url: '//node.testnet.com/accounts', 
				expected: false 
			},

			// Structurally broken URLs
			{ 
				description: 'returns false for a scheme without a host', 
				url: 'https://', 
				expected: false 
			},
			{ 
				description: 'returns false for a single-slash scheme separator', 
				url: 'http:/node.testnet.com', 
				expected: false 
			},
			{ 
				description: 'returns false for a URL with a leading space', 
				url: ' https://node.testnet.com', 
				expected: false 
			}
		];

		tests.forEach(test => {
			runIsValidRequestUrlTest(test.description, test.url, test.expected);
		});
	});
});
