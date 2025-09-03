import { networkIdentifiers } from './__fixtures__/local/wallet';
import fs from 'fs';

export const writeFileJSON = (fileName, data) => {
	fs.writeFileSync(`./${fileName}.json`, JSON.stringify(data, null, 4));
};

export const createNetworkMap = (networkIdentifiers, callback) => {
	const maps = networkIdentifiers.map(networkIdentifier => [networkIdentifier, callback(networkIdentifier)]);

	return Object.fromEntries(maps);
};

/**
 * Run a test function by iterating over all network related accounts.
 * @template ItemType
 * @param {object<string, ItemType[]>} networkMap - The network map.
 * @param {function(string, ItemType, number)} testFunction - The test function.
 */
export const forEachNetwork = (networkMap, testFunction) => {
	createNetworkMap(networkIdentifiers, networkIdentifier => {
		networkMap[networkIdentifier].map((item, index) => {
			testFunction(networkIdentifier, item, index);
		});
	});
};

/**
 * Runs a test for a function that makes API calls.
 * @param {jest.Mock} mockFetch - The mocked fetch function.
 * @param {function} functionToTest - The function to test.
 * @param {Array<{url: string, options: object, response: any}>}expectedCalls - The expected API calls.
 * @param {object} [expectedResult] - Optional checks if the result matches the expected calls; if an object, compares the result with it.
 */
export const runApiTest = async (mockFetch, functionToTest, expectedCalls, expectedResult) => {
	// Arrange:
	mockFetch.mockImplementation(async (url, options) => {
		const matchingCall = expectedCalls.find(call => {
			if (call.url !== url) 
				return false;

			// If options are not specified in the expected call, ensure no options were passed
			if (!call.options)
				return !options;

			// Otherwise, compare options
			return JSON.stringify(call.options) === JSON.stringify(options);
		});
		
		if (matchingCall)
			return Promise.resolve(matchingCall.response);
		
		return Promise.reject(new Error(`[Test error] Unexpected API call. URL: ${url}, Options: ${JSON.stringify(options)}`));
	});

	// Act:
	const result = await functionToTest();

	// Assert:
	expectedCalls.forEach(call => {
		if (call.options)
			expect(mockFetch).toHaveBeenCalledWith(call.url, call.options);
		else
			expect(mockFetch).toHaveBeenCalledWith(call.url);
	});

	if (expectedResult) 
		expect(result).toStrictEqual(expectedResult);
};
