import { absoluteToRelativeAmount, relativeToAbsoluteAmount, safeOperationWithRelativeAmounts } from '../../src/utils/convert';
import { jest } from '@jest/globals';

describe('utils/convert', () => {
	describe('absoluteToRelativeAmount', () => {
		const absoluteToRelativeCases = [
			{
				testName: 'returns "0" for zero with divisibility 0',
				absoluteAmount: '0',
				divisibility: 0,
				expectedResult: '0'
			},
			{
				testName: 'returns "0" for zero with divisibility > 0',
				absoluteAmount: '0',
				divisibility: 6,
				expectedResult: '0'
			},
			{
				testName: 'converts small absolute with padding (1, 6) -> "0.000001"',
				absoluteAmount: '1',
				divisibility: 6,
				expectedResult: '0.000001'
			},
			{
				testName: 'converts integer boundary (1000, 3) -> "1"',
				absoluteAmount: '1000',
				divisibility: 3,
				expectedResult: '1'
			},
			{
				testName: 'converts fractional (123456, 6) -> "0.123456"',
				absoluteAmount: '123456',
				divisibility: 6,
				expectedResult: '0.123456'
			},
			{
				testName: 'trims trailing zeros in fractional (1200, 4) -> "0.12"',
				absoluteAmount: '1200',
				divisibility: 4,
				expectedResult: '0.12'
			},
			{
				testName: 'removes fractional part completely when all zeros (123000, 3) -> "123"',
				absoluteAmount: '123000',
				divisibility: 3,
				expectedResult: '123'
			},
			{
				testName: 'large integer equality (1000000, 6) -> "1"',
				absoluteAmount: '1000000',
				divisibility: 6,
				expectedResult: '1'
			},
			{
				testName: 'supports number input (123456 as number, 6) -> "0.123456"',
				absoluteAmount: 123456,
				divisibility: 6,
				expectedResult: '0.123456'
			},
			{
				testName: 'handles divisibility 0 as identity (1000, 0) -> "1000"',
				absoluteAmount: '1000',
				divisibility: 0,
				expectedResult: '1000'
			}
		];

		absoluteToRelativeCases.forEach(({ testName, absoluteAmount, divisibility, expectedResult }) => {
			it(testName, () => {
				const result = absoluteToRelativeAmount(absoluteAmount, divisibility);
				expect(result).toBe(expectedResult);
				expect(typeof result).toBe('string');
			});
		});
	});

	describe('relativeToAbsoluteAmount', () => {
		const relativeToAbsoluteCases = [
			{
				testName: 'returns "0" for "0" with any divisibility',
				relativeAmount: '0',
				divisibility: 6,
				expectedResult: '0'
			},
			{
				testName: 'returns "0" for "0.0" with any divisibility',
				relativeAmount: '0.0',
				divisibility: 6,
				expectedResult: '0'
			},
			{
				testName: 'pads fractional part to divisibility ("1.2", 6) -> "1200000"',
				relativeAmount: '1.2',
				divisibility: 6,
				expectedResult: '1200000'
			},
			{
				testName: 'cuts extra fractional digits ("1.23456789", 6) -> "1234567"',
				relativeAmount: '1.23456789',
				divisibility: 6,
				expectedResult: '1234567'
			},
			{
				testName: 'multiplies integer by 10^divisibility ("1", 3) -> "1000"',
				relativeAmount: '1',
				divisibility: 3,
				expectedResult: '1000'
			},
			{
				testName: 'handles missing integer part (".5", 2) -> "50"',
				relativeAmount: '.5',
				divisibility: 2,
				expectedResult: '50'
			},
			{
				testName: 'normalizes leading zeros ("0001.002300", 6) -> "1002300"',
				relativeAmount: '0001.002300',
				divisibility: 6,
				expectedResult: '1002300'
			},
			{
				testName: 'small fractional -> minimal non-zero ("0.0001", 6) -> "100"',
				relativeAmount: '0.0001',
				divisibility: 6,
				expectedResult: '100'
			},
			{
				testName: 'divisibility 0 drops fractional part ("123.456", 0) -> "123"',
				relativeAmount: '123.456',
				divisibility: 0,
				expectedResult: '123'
			},
			{
				testName: 'divisibility 0 with integer only ("999", 0) -> "999"',
				relativeAmount: '999',
				divisibility: 0,
				expectedResult: '999'
			},
			{
				testName: 'large integer with padding ("12345678901234567890", 6) -> "12345678901234567890000000"',
				relativeAmount: '12345678901234567890',
				divisibility: 6,
				expectedResult: '12345678901234567890000000'
			},
			{
				testName: 'large float ("12345678901234567890.123456", 6) -> "12345678901234567890123456"',
				relativeAmount: '12345678901234567890.123456',
				divisibility: 6,
				expectedResult: '12345678901234567890123456'
			}
		];

		relativeToAbsoluteCases.forEach(({ testName, relativeAmount, divisibility, expectedResult }) => {
			it(testName, () => {
				const result = relativeToAbsoluteAmount(relativeAmount, divisibility);
				expect(result).toBe(expectedResult);
				expect(typeof result).toBe('string');
			});
		});
	});

	describe('round-trip consistency for typical values', () => {
		it('absolute -> relative -> absolute returns original numeric value when no leading zeros are involved', () => {
			// Arrange:
			const absolute = '12345600';
			const divisibility = 6;
			const expected = '12345600';
			const expectedRelative = '12.3456';

			// Act:
			const relative = absoluteToRelativeAmount(absolute, divisibility);
			const backToAbsolute = relativeToAbsoluteAmount(relative, divisibility);

			// Assert:
			expect(relative).toBe(expectedRelative);
			expect(backToAbsolute).toBe(expected);
		});

		it('relative -> absolute -> relative returns normalized relative form', () => {
			// Arrange:
			const relative = '12.3400';
			const divisibility = 6;
			const expectedRelativeNormalized = '12.34';
			const expectedAbsolute = '12340000';

			// Act:
			const absolute = relativeToAbsoluteAmount(relative, divisibility);
			const normalizedRelative = absoluteToRelativeAmount(absolute, divisibility);

			// Assert:
			expect(absolute).toBe(expectedAbsolute);
			expect(normalizedRelative).toBe(expectedRelativeNormalized);
		});
	});

	describe('safeOperationWithRelativeAmounts', () => {
		const largeFloat = '12345678901234567890.123456';

		const ops = {
			add: (...args) => args.reduce((a, b) => a + b, 0n),
			subtract: (a, b) => a - b,
			average: (...args) => (args.length ? args.reduce((a, b) => a + b, 0n) / BigInt(args.length) : 0n),
			zero: () => 0n
		};

		describe('cases', () => {
			const cases = [
				{
					name: 'sums multiple relative values (divisibility 6)',
					divisibility: 6,
					values: ['0.000001', '1.000000', '12.34'],
					callback: ops.add,
					expected: '13.340001'
				},
				{
					name: 'sums multiple relative values (divisibility 2)',
					divisibility: 2,
					values: ['0.15', '0.15', '0.15'],
					callback: ops.add,
					expected: '0.45'
				},
				{
					name: 'divisibility 0: identity addition',
					divisibility: 0,
					values: ['123', '456'],
					callback: ops.add,
					expected: '579'
				},
				{
					name: 'handles missing integer part and leading zeros',
					divisibility: 2,
					values: ['.5', '0001.25', '0.0000'],
					callback: ops.add,
					expected: '1.75'
				},
				{
					name: 'works with very large values via BigInt',
					divisibility: 6,
					values: [largeFloat, largeFloat],
					callback: ops.add,
					expected: '24691357802469135780.246912'
				},
				{
					name: 'supports custom operations (average of two values with exact scaling)',
					divisibility: 1,
					values: ['1.0', '2.0'],
					callback: ops.average,
					expected: '1.5'
				},
				{
					name: 'empty values with callback returning 0n -> "0"',
					divisibility: 6,
					values: [],
					callback: ops.zero,
					expected: '0'
				},
				{
					name: 'subtraction resulting in zero normalizes to "0"',
					divisibility: 6,
					values: ['12.3400', '12.34'],
					callback: ops.subtract,
					expected: '0'
				}
			];

			cases.forEach(({ name, divisibility, values, callback, expected }) => {
				it(name, () => {
					const result = safeOperationWithRelativeAmounts(divisibility, values, callback);
					expect(result).toBe(expected);
				});
			});
		});

		it('passes BigInt absolute amounts to callback in order', () => {
			const divisibility = 6;
			const values = ['0.000001', '1', '12.34'];
			const spy = jest.fn(() => 0n);

			const result = safeOperationWithRelativeAmounts(divisibility, values, spy);

			expect(result).toBe('0');
			expect(spy).toHaveBeenCalledTimes(1);
			expect(spy.mock.calls[0]).toEqual([1n, 1000000n, 12340000n]);
			expect(spy.mock.calls[0].every(v => typeof v === 'bigint')).toBe(true);
		});

		it('throws on negative divisibility', () => {
			expect(() =>
				safeOperationWithRelativeAmounts(-1, ['0'], () => 0n)).toThrow('Divisibility must be a non-negative integer');
		});
	});
});
