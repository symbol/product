import { Api } from '../src/api';
import { expect } from '@jest/globals';

/**
 * Builds a makeRequest mock from a request map keyed by URL. A mapped Error is rejected (to model an
 * HTTP failure); any other value is resolved. Unmapped URLs reject so unexpected requests fail loudly.
 * @param {Record<string, any>} requestMap - Map of request URL to its response (or an Error to reject).
 * @returns {function(string): Promise<any>} The makeRequest mock.
 */
export const createMakeRequestMock = requestMap => async url => {
	if (!(url in requestMap))
		throw new Error(`[Test] Unexpected request to ${url}`);

	const response = requestMap[url];

	return response instanceof Error ? Promise.reject(response) : response;
};

/**
 * Runs an API service method end-to-end with only makeRequest mocked, then asserts the returned value.
 * The whole Api is wired with a makeRequest backed by the request map, so a method may delegate to other
 * services without extra mocking — every request it makes is served from the map.
 * @param {object} options - The test options.
 * @param {Record<string, any>} options.requestMap - Map of request URL to its response (or an Error).
 * @param {object} [options.config] - The Api config (e.g. nodewatchURL), required only by NetworkService.
 * @param {function(Api): Promise<any>} options.call - Invokes the method under test on the given Api.
 * @param {any} options.expected - The expected return value.
 */
export const runApiServiceTest = async ({ requestMap, config, call, expected }) => {
	// Arrange:
	const makeRequest = createMakeRequestMock(requestMap);
	const api = new Api({ makeRequest, config });

	// Act:
	const result = await call(api);

	// Assert:
	expect(result).toStrictEqual(expected);
};
