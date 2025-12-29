import { makeRequest } from '@/app/utils/network';
import { InternalServerError, InvalidRequestError, NetworkRequestError, NotFoundError, RateLimitError } from 'wallet-common-core';

describe('utils/network', () => {
	const createMockResponse = (ok, status, body, statusText = 'Error') => ({
		ok,
		status,
		statusText,
		json: jest.fn().mockResolvedValue(body)
	});

	const createMockErrorResponse = (status, errorBody, statusText = 'Error') =>
		createMockResponse(false, status, errorBody, statusText);

	beforeEach(() => {
		global.fetch = jest.fn();
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

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

		it('falls back to statusText when JSON parsing fails', async () => {
			// Arrange:
			const mockResponse = {
				ok: false,
				status: 400,
				statusText: 'Bad Request',
				json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
			};
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
