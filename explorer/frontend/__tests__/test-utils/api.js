import { runTestCases } from './page';
import * as utils from '@/app/utils/server';

export const runApiTest = async (functionToTest, searchCriteria, response, expectedURL, expectedResult) => {
	// Arrange:
	const spy = jest.spyOn(utils, 'makeRequest');
	spy.mockResolvedValue(response);

	// Act:
	const result = await functionToTest(searchCriteria);

	// Assert:
	expect(spy).toHaveBeenCalledWith(expectedURL);
	expect(result).toEqual(expectedResult);
};

export const runApiRequestTests = ({ functionToTest, response, cases }) => {
	const runApiRequestTest = (description, config, expected) => {
		it(description, async () => {
			// Arrange:
			const spy = jest.spyOn(utils, 'makeRequest');
			spy.mockResolvedValue(response);

			// Act:
			await functionToTest(config.params);

			// Assert:
			expect(spy).toHaveBeenCalledWith(expected.url);
		});
	};

	runTestCases(runApiRequestTest, cases);
};

export const runApiResultTests = ({ functionToTest, cases }) => {
	const runApiResultTest = (description, config, expected) => {
		it(description, async () => {
			// Arrange: resolve the request with the case response, or reject it with the case error.
			const spy = jest.spyOn(utils, 'makeRequest');

			if (config.error)
				spy.mockRejectedValue(config.error);
			else
				spy.mockResolvedValue(config.response);

			// Act:
			const result = await functionToTest(config.params);

			// Assert:
			expect(result).toStrictEqual(expected.result);
		});
	};

	runTestCases(runApiResultTest, cases);
};

export const error404Response = {
	response: {
		data: {
			status: 404
		}
	}
};
