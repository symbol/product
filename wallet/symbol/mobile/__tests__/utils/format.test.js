import { getUserCurrencyAmountText, truncateMiddle } from '@/app/utils/format';

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

	describe('getUserCurrencyAmountText', () => {
		const runGetUserCurrencyAmountTextTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const { amount, price, networkIdentifier } = config;

				// Act:
				const result = getUserCurrencyAmountText(amount, price, networkIdentifier);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const price = { value: 0.5, currency: 'USD' };

		const tests = [
			{
				description: 'formats the converted amount on mainnet',
				config: { amount: 1000, price, networkIdentifier: 'mainnet' },
				expected: { result: '~500.00 USD' }
			},
			{
				description: 'returns a zero amount when the balance is empty',
				config: { amount: 0, price, networkIdentifier: 'mainnet' },
				expected: { result: '0.00 USD' }
			},
			{
				description: 'returns an empty string on non-mainnet networks',
				config: { amount: 1000, price, networkIdentifier: 'testnet' },
				expected: { result: '' }
			},
			{
				description: 'returns an empty string when the price is missing',
				config: { amount: 1000, price: null, networkIdentifier: 'mainnet' },
				expected: { result: '' }
			},
			{
				description: 'returns an empty string when the price value is undefined',
				config: { amount: 1000, price: { value: undefined, currency: 'USD' }, networkIdentifier: 'mainnet' },
				expected: { result: '' }
			},
			{
				description: 'returns an empty string when the price value is not a finite number',
				config: { amount: 1000, price: { value: NaN, currency: 'USD' }, networkIdentifier: 'mainnet' },
				expected: { result: '' }
			}
		];

		tests.forEach(test => runGetUserCurrencyAmountTextTest(test.description, test.config, test.expected));
	});
});
