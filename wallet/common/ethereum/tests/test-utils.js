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
 * @param {Array<{url: string, options: object, response: any}>} expectedCalls - The expected API calls.
 * @param {object} [options] - Additional options.
 * @param {object} [options.expectedResult] - Optional checks if the return value matches the expected result.
 * @param {string} [options.expectedErrorMessage] - Optional checks if the thrown error message matches the expected message.
 */
export const runApiTest = async (mockFetch, functionToTest, expectedCalls, { expectedResult, expectedErrorMessage } = {}) => {
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
	let result;
	let caughtError;
	try {
		result = await functionToTest();
	} catch (error) {
		caughtError = error;
	}

	// Assert:
	// Calls
	expectedCalls.forEach(call => {
		if (call.options)
			expect(mockFetch).toHaveBeenCalledWith(call.url, call.options);
		else
			expect(mockFetch).toHaveBeenCalledWith(call.url);
	});
	expect(mockFetch).toHaveBeenCalledTimes(expectedCalls.length);

	// Return value
	if (expectedResult !== undefined) {
		expect(result).toStrictEqual(expectedResult);
	}

	// Error
	else if (expectedErrorMessage) {
		expect(caughtError).toBeDefined();
		expect(caughtError.message).toBe(expectedErrorMessage);
	}

	// If no error expected, then caught error is unexpected
	else if (caughtError) {
		throw caughtError;
	}
};
