import {
	createSearchUrl,
	networkTimestampToUnix,
	toFixedNumber,
	toFixedNumericString
} from '../../src/utils/helper';

describe('utils/helper', () => {
	describe('toFixedNumber', () => {
		const runToFixedNumberTest = (num, digits, expected) => {
			// Act:
			const result = toFixedNumber(num, digits);

			// Assert:
			expect(result).toBe(expected);
		};

		it('returns a number with a fixed number of digits', () => {
			// Arrange:
			const testCases = [
				{ num: 1.234, digits: 2, expected: 1.23 },
				{ num: 1.236, digits: 2, expected: 1.24 },
				{ num: 1.235, digits: 2, expected: 1.24 },
				{ num: 123, digits: 2, expected: 123 },
				{ num: 1.234, digits: 0, expected: 1 }
			];

			// Act & Assert:
			testCases.forEach(({ num, digits, expected }) => {
				runToFixedNumberTest(num, digits, expected);
			});
		});
	});

	describe('toFixedNumericString', () => {
		const runToFixedNumericStringTest = (num, divisibility, expected) => {
			// Act:
			const result = toFixedNumericString(num, divisibility);

			// Assert:
			expect(result).toBe(expected);
		};

		it('returns a formatted numeric string with correct decimal placement', () => {
			// Arrange:
			const testCases = [
				{ num: 123.4, divisibility: 6, expected: '123.400000' },
				{ num: 123, divisibility: 2, expected: '123.00' },
				{ num: 123.456, divisibility: 3, expected: '123.456' }
			];

			// Act & Assert:
			testCases.forEach(({ num, divisibility, expected }) => {
				runToFixedNumericStringTest(num, divisibility, expected);
			});
		});

		it('returns the number as a string if divisibility is 0', () => {
			// Act & Assert:
			runToFixedNumericStringTest(123, 0, '123');
		});
	});

	describe('networkTimestampToUnix', () => {
		const runTimestampToLocalDateTest = (timestamp, epochAdjustment, expected) => {
			// Act:
			const result = networkTimestampToUnix(timestamp, epochAdjustment);

			// Assert:
			expect(result).toEqual(expected);
		};

		it('converts a chain timestamp to a local date', () => {
			// Arrange:
			const timestamp = 1000; // Milliseconds from network epoch
			const epochAdjustment = 1615853185; // Seconds from unix epoch to network epoch
			const expectedLocalDate = 1615853186000;

			// Act & Assert:
			runTimestampToLocalDateTest(timestamp, epochAdjustment, expectedLocalDate);
		});
	});

	describe('createSearchUrl', () => {
		// Arrange:
		const nodeUrl = 'http://localhost:3000';
		const path = '/api/items';

		const runCreateSearchUrlTest = (functionArguments, expectedResult) => {
			// Act:
			const result = createSearchUrl(
				functionArguments.nodeUrl,
				functionArguments.path,
				functionArguments.searchCriteria,
				functionArguments.additionalParams
			);

			// Assert:
			expect(result).toBe(expectedResult);
		};

		it('creates a URL with default search criteria', () => {
			// Arrange:
			const expectedUrl = 'http://localhost:3000/api/items?pageNumber=1&pageSize=100&order=desc';

			// Act & Assert:
			runCreateSearchUrlTest({ nodeUrl, path }, expectedUrl);
		});

		it('creates a URL with custom search criteria', () => {
			// Arrange:
			const searchCriteria = { pageNumber: 2, pageSize: 50, order: 'asc' };
			const expectedUrl = 'http://localhost:3000/api/items?pageNumber=2&pageSize=50&order=asc';

			// Act & Assert:
			runCreateSearchUrlTest(
				{ nodeUrl, path, searchCriteria },
				expectedUrl
			);
		});

		it('creates a URL with additional parameters', () => {
			// Arrange:
			const additionalParams = { type: 'A', status: 'active' };
			const expectedUrl = 'http://localhost:3000/api/items?pageNumber=1&pageSize=100&order=desc&type=A&status=active';

			// Act & Assert:
			runCreateSearchUrlTest(
				{ nodeUrl, path, searchCriteria: {}, additionalParams },
				expectedUrl
			);
		});

		it('creates a URL with custom criteria and additional parameters', () => {
			// Arrange:
			const searchCriteria = { pageNumber: 5, pageSize: 10, order: 'asc' };
			const additionalParams = { user: 'test' };
			const expectedUrl = 'http://localhost:3000/api/items?pageNumber=5&pageSize=10&order=asc&user=test';

			// Act & Assert:
			runCreateSearchUrlTest(
				{ nodeUrl, path, searchCriteria, additionalParams },
				expectedUrl
			);
		});
	});
});
