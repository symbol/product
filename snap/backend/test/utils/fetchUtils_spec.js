import fetchUtils from '../../src/utils/fetchUtils.js';
import { describe, jest } from '@jest/globals';

jest.spyOn(global, 'fetch').mockImplementation();

describe('fetchUtils', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	const runBasicFetchDataTest = async method => {
		it(`should fetch data successfully with ${method} method`, async () => {
			// Arrange:
			const url = 'https://example.com';
			const data = 'result data';
			fetch.mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce(data)
			});

			// Act:
			const result = await fetchUtils.fetchData(url, method);

			// Assert:
			expect(fetch).toHaveBeenCalledWith(url, {
				method: `${method}`,
				headers: {
					'Content-Type': 'application/json'
				}
			});
			expect(result).toStrictEqual(data);
		});

		it(`should throw an error if the response is not ok with ${method} method`, async () => {
			// Arrange:
			const url = 'https://example.com';
			fetch.mockResolvedValueOnce({
				ok: false,
				statusText: 'Not Found'
			});

			// Assert:
			await expect(fetchUtils.fetchData(url, method)).rejects.toThrow('Failed to fetch: Not Found');
			expect(fetch).toHaveBeenCalledWith(url, {
				method: `${method}`,
				headers: {
					'Content-Type': 'application/json'
				}
			});
		});
	};

	describe('fetchData', () => {
		runBasicFetchDataTest('GET');

		runBasicFetchDataTest('POST');

		it('should fetch data successfully with default GET method', async () => {
			// Arrange:
			const url = 'https://example.com';
			const data = { key: 'value' };
			fetch.mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValueOnce(data)
			});

			// Act:
			const result = await fetchUtils.fetchData(url);

			// Assert:
			expect(fetch).toHaveBeenCalledWith(url, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});
			expect(result).toStrictEqual(data);
		});

		it('should throw an error if the response is not ok with default GET method', async () => {
			// Arrange:
			const url = 'https://example.com';
			fetch.mockResolvedValueOnce({
				ok: false,
				statusText: 'Not Found'
			});

			// Assert:
			await expect(fetchUtils.fetchData(url)).rejects.toThrow('Failed to fetch: Not Found');
			expect(fetch).toHaveBeenCalledWith(url, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});
		});
	});
});
