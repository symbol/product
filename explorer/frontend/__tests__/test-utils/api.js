import * as utils from '@/app/utils/server';

export const runApiTest = async (functionToTest, searchCriteria, response, expectedURL, expectedResult, print) => {
	// Arrange:
	const spy = jest.spyOn(utils, 'makeRequest');
	spy.mockResolvedValue(response);

	// Act:
	const result = await functionToTest(searchCriteria);

	// Assert:
	expect(spy).toHaveBeenCalledWith(expectedURL);
	expect(result).toEqual(expectedResult);
};

export const error404Response = {
	response: {
		data: {
			status: 404
		}
	}
};
