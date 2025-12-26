import { makeRequest } from '@/app/utils/network';
import { InternalServerError, InvalidRequestError, NetworkRequestError, NotFoundError, RateLimitError } from 'wallet-common-core';

describe('makeRequest', () => {
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
		const runErrorResponseTest = (config, expected) => {
			it(`throws ${expected.errorType.name} for status ${config.status}`, async () => {
				// Arrange:
				global.fetch.mockResolvedValue(createMockErrorResponse(config.status, config.errorBody));

				// Act & Assert:
				await expect(makeRequest('https://example.com', {})).rejects.toThrow(expected.errorType);
			});
		};

		const tests = [
			{ status: 400, errorBody: { message: 'Bad Request' }, expected: { errorType: InvalidRequestError } },
			{ status: 409, errorBody: { message: 'Conflict' }, expected: { errorType: InvalidRequestError } },
			{ status: 404, errorBody: { message: 'Not Found' }, expected: { errorType: NotFoundError } },
			{ status: 429, errorBody: { message: 'Too Many Requests' }, expected: { errorType: RateLimitError } },
			{ status: 500, errorBody: { message: 'Internal Server Error' }, expected: { errorType: InternalServerError } },
			{ status: 502, errorBody: { message: 'Bad Gateway' }, expected: { errorType: InternalServerError } },
			{ status: 503, errorBody: { message: 'Service Unavailable' }, expected: { errorType: NetworkRequestError } }
		];

		tests.forEach(test => {
			runErrorResponseTest({ status: test.status, errorBody: test.errorBody }, test.expected);
		});
	});

	describe('error message extraction', () => {
		const runErrorMessageTest = (config, expected) => {
			it(`extracts error message from ${config.description}`, async () => {
				// Arrange:
				global.fetch.mockResolvedValue(createMockErrorResponse(config.status, config.errorBody));

				// Act & Assert:
				await expect(makeRequest('https://example.com', {})).rejects.toThrow(expected.message);
			});
		};

		const tests = [
			{
				description: 'message property',
				status: 400,
				errorBody: { message: 'validation failed' },
				expected: { message: 'validation failed' }
			},
			{
				description: 'error property',
				status: 400,
				errorBody: { error: 'invalid input' },
				expected: { message: 'invalid input' }
			}
		];

		tests.forEach(test => {
			runErrorMessageTest(
				{ description: test.description, status: test.status, errorBody: test.errorBody },
				test.expected
			);
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
		const runRequestOptionsTest = (config, expected) => {
			it(`passes ${config.description} to fetch`, async () => {
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
				description: 'GET request options',
				url: 'https://api.example.com/data',
				options: { method: 'GET' },
				expected: { url: 'https://api.example.com/data', options: { method: 'GET' } }
			},
			{
				description: 'POST request with body',
				url: 'https://api.example.com/submit',
				options: { method: 'POST', body: JSON.stringify({ key: 'value' }) },
				expected: { url: 'https://api.example.com/submit', options: { method: 'POST', body: JSON.stringify({ key: 'value' }) } }
			},
			{
				description: 'request with headers',
				url: 'https://api.example.com/auth',
				options: { headers: { Authorization: 'Bearer token' } },
				expected: { url: 'https://api.example.com/auth', options: { headers: { Authorization: 'Bearer token' } } }
			}
		];

		tests.forEach(test => {
			runRequestOptionsTest(
				{ description: test.description, url: test.url, options: test.options },
				test.expected
			);
		});
	});
});
