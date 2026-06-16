import { truncateMiddle } from '@/app/utils/format';

const LONG_SECRET = '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF';

describe('utils/format', () => {
	describe('truncateMiddle', () => {
		const runTruncateMiddleTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const { value, startLength, endLength } = config;

				// Act:
				const result = truncateMiddle(value, startLength, endLength);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const tests = [
			{
				description: 'truncates a long string in the middle keeping the start and end',
				config: { value: LONG_SECRET, startLength: 8, endLength: 8 },
				expected: { result: '01234567...89ABCDEF' }
			},
			{
				description: 'returns the original string when it is short enough',
				config: { value: 'SECRET', startLength: 8, endLength: 8 },
				expected: { result: 'SECRET' }
			},
			{
				description: 'returns the original string at the truncation boundary',
				config: { value: 'ABCDEFGHIJK', startLength: 4, endLength: 4 },
				expected: { result: 'ABCDEFGHIJK' }
			},
			{
				description: 'truncates when one character over the boundary',
				config: { value: 'ABCDEFGHIJKL', startLength: 4, endLength: 4 },
				expected: { result: 'ABCD...IJKL' }
			},
			{
				description: 'returns an empty string unchanged',
				config: { value: '', startLength: 8, endLength: 8 },
				expected: { result: '' }
			}
		];

		tests.forEach(test => runTruncateMiddleTest(test.description, test.config, test.expected));
	});
});
