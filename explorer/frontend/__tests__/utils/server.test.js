import { createFetchInfoFunction, createPage, createSearchCriteria, createSearchURL, makeRequest } from '@/utils/server';
import mockAxios from 'jest-mock-axios';

afterEach(() => {
	mockAxios.reset();
});

describe('utils/server', () => {
	describe('createFetchInfoFunction', () => {
		it('returns result of fetch function', async () => {
			// Arrange:
			const fetchFunction = jest.fn().mockResolvedValue(45);
			const functionArguments = ['a', 1, null, () => {}];
			const expectedResult = 45;
			const wrappedFetchFunction = createFetchInfoFunction(fetchFunction);

			// Act:
			const result = await wrappedFetchFunction(...functionArguments);

			// Assert:
			expect(result).toBe(expectedResult);
			expect(fetchFunction).toHaveBeenCalledWith(...functionArguments);
		});

		it('returns null if function throws error with 404 status', async () => {
			// Arrange:
			const fetchFunction = jest.fn().mockRejectedValue({
				response: {
					data: {
						status: 404
					}
				}
			});
			const expectedResult = null;
			const wrappedFetchFunction = createFetchInfoFunction(fetchFunction);

			// Act:
			const result = await wrappedFetchFunction();

			// Assert:
			expect(result).toBe(expectedResult);
		});

		it('throws error if function throws error with no 404 status', async () => {
			// Arrange:
			const error = {
				status: 502
			};
			const fetchFunction = jest.fn().mockRejectedValue({
				response: {
					data: error
				}
			});
			const wrappedFetchFunction = createFetchInfoFunction(fetchFunction);

			// Act:
			const promise = wrappedFetchFunction();

			// Assert:
			return expect(promise).rejects.toBe(error);
		});
	});

	describe('createPage', () => {
		const runCreatePageTest = (data, formatter, expectedResult) => {
			// Act:
			const result = createPage(data, 1, formatter);

			//Assert:
			expect(result).toEqual(expectedResult);
		};

		it('returns page with formatted items', () => {
			// Arrange:
			const data = [1, 2, 3];
			const formatter = item => item * 2;
			const expectedResult = {
				data: [2, 4, 6],
				pageNumber: 1
			};

			// Act + Assert:
			runCreatePageTest(data, formatter, expectedResult);
		});

		it('returns page with original items if no formatter provided', () => {
			// Arrange:
			const data = [1, 2, 3];
			const formatter = null;
			const expectedResult = {
				data: [1, 2, 3],
				pageNumber: 1
			};

			// Act + Assert:
			runCreatePageTest(data, formatter, expectedResult);
		});

		it('returns page with empty data', () => {
			// Arrange:
			const data = [];
			const formatter = item => item * 2;
			const expectedResult = {
				data: [],
				pageNumber: 1
			};

			// Act + Assert:
			runCreatePageTest(data, formatter, expectedResult);
		});
	});

	describe('createSearchCriteria', () => {
		const runCreateSearchCriteriaTest = (searchParams, expectedResult) => {
			// Act:
			const result = createSearchCriteria(searchParams);

			//Assert:
			expect(result).toEqual(expectedResult);
		};

		it('returns default searchCriteria if searchParams is empty or invalid', () => {
			// Arrange:
			const searchParams1 = undefined;
			const searchParams2 = {};
			const searchParams3 = {
				pageNumber: 'one',
				pageSize: 'ten'
			};
			const expectedResult = {
				pageNumber: 1,
				pageSize: 10,
				filter: {}
			};

			// Act + Assert:
			runCreateSearchCriteriaTest(searchParams1, expectedResult);
			runCreateSearchCriteriaTest(searchParams2, expectedResult);
			runCreateSearchCriteriaTest(searchParams3, expectedResult);
		});

		it('returns searchCriteria from specified searchParams', () => {
			// Arrange:
			const searchParams = {
				pageNumber: 2,
				pageSize: 100
			};
			const expectedResult = {
				pageNumber: 2,
				pageSize: 100,
				filter: {}
			};

			// Act + Assert:
			runCreateSearchCriteriaTest(searchParams, expectedResult);
		});

		it('returns searchCriteria from specified searchParams with filter', () => {
			// Arrange:
			const searchParams = {
				pageNumber: 2,
				pageSize: 100,
				address: 'foo',
				direction: 'incoming'
			};
			const expectedResult = {
				pageNumber: 2,
				pageSize: 100,
				filter: {
					address: 'foo',
					direction: 'incoming'
				}
			};

			// Act + Assert:
			runCreateSearchCriteriaTest(searchParams, expectedResult);
		});
	});

	describe('createSearchURL', () => {
		it('returns search URL from search criteria', () => {
			// Arrange:
			const baseURL = 'http://foo.bar';
			const searchCriteria = {
				pageNumber: 3,
				pageSize: 100,
				filter: {
					address: 'foo',
					direction: 'incoming'
				}
			};
			const expectedResult = 'http://foo.bar?limit=100&offset=200&address=foo&direction=incoming';

			// Act:
			const result = createSearchURL(baseURL, searchCriteria);

			// Assert:
			expect(result).toBe(expectedResult);
		});
	});

	describe('makeRequest', () => {
		// Arrange:
		const url = 'http://foo.bar';
		const axiosReturnValue = {
			data: 12
		};

		it('calls axios with default options', async () => {
			// Arrange:
			mockAxios.mockResolvedValue(axiosReturnValue);
			const expectedResult = axiosReturnValue.data;
			const expectedOptions = {
				method: 'get',
				url,
				data: undefined,
				timeout: 5000
			};

			// Act:
			const result = await makeRequest(url);

			// Assert:
			expect(result).toBe(expectedResult);
			expect(mockAxios).toHaveBeenCalledWith(expectedOptions);
		});

		it('calls axios with custom options', async () => {
			// Arrange:
			mockAxios.mockResolvedValue(axiosReturnValue);
			const options = {
				method: 'post',
				timeout: 200,
				data: {
					a: 'foo'
				}
			};
			const expectedResult = axiosReturnValue.data;
			const expectedOptions = {
				method: options.method,
				url,
				data: options.data,
				timeout: options.timeout
			};

			// Act:
			const result = await makeRequest(url, options);

			// Assert:
			expect(result).toBe(expectedResult);
			expect(mockAxios).toHaveBeenCalledWith(expectedOptions);
		});
	});
});
