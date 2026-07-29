import {
	MAX_SQRT_PRICE_LIMIT_X96,
	MIN_SQRT_PRICE_LIMIT_X96,
	applySaturationHaircut,
	isSaturatedQuote,
	isZeroForOne
} from '../../src/utils/uniswap';

// Constants

const LOWER_TOKEN_ID = '0xac461bf5a6554e8406f58b192d83aeea695e229b';
const HIGHER_TOKEN_ID = '0xfff9976782d46cc05630d1f6ebab18b2324d6b14';
const midRangeSqrtPriceX96 = '93455262124906132660367607190557';

describe('utils/uniswap', () => {
	describe('isZeroForOne', () => {
		const runIsZeroForOneTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = isZeroForOne(config.tokenInId, config.tokenOutId);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const isZeroForOneTests = [
			{
				description: 'returns true when the input token has the lower address',
				config: { tokenInId: LOWER_TOKEN_ID, tokenOutId: HIGHER_TOKEN_ID },
				expected: { result: true }
			},
			{
				description: 'returns false when the input token has the higher address',
				config: { tokenInId: HIGHER_TOKEN_ID, tokenOutId: LOWER_TOKEN_ID },
				expected: { result: false }
			},
			{
				description: 'compares addresses case-insensitively',
				config: { tokenInId: LOWER_TOKEN_ID.toUpperCase().replace('0X', '0x'), tokenOutId: HIGHER_TOKEN_ID },
				expected: { result: true }
			}
		];

		isZeroForOneTests.forEach(test => {
			runIsZeroForOneTest(test.description, test.config, test.expected);
		});
	});

	describe('isSaturatedQuote', () => {
		const runIsSaturatedQuoteTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = isSaturatedQuote(config.sqrtPriceX96After, config.zeroForOne);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const isSaturatedQuoteTests = [
			{
				description: 'detects saturation at the lower boundary for a zero-for-one swap',
				config: { sqrtPriceX96After: MIN_SQRT_PRICE_LIMIT_X96.toString(), zeroForOne: true },
				expected: { result: true }
			},
			{
				description: 'detects saturation at the upper boundary for a one-for-zero swap',
				config: { sqrtPriceX96After: MAX_SQRT_PRICE_LIMIT_X96.toString(), zeroForOne: false },
				expected: { result: true }
			},
			{
				description: 'ignores the opposite direction boundary',
				config: { sqrtPriceX96After: MAX_SQRT_PRICE_LIMIT_X96.toString(), zeroForOne: true },
				expected: { result: false }
			},
			{
				description: 'returns false for a mid-range price',
				config: { sqrtPriceX96After: midRangeSqrtPriceX96, zeroForOne: false },
				expected: { result: false }
			},
			{
				description: 'returns false one step away from the boundary',
				config: { sqrtPriceX96After: (MAX_SQRT_PRICE_LIMIT_X96 - 1n).toString(), zeroForOne: false },
				expected: { result: false }
			}
		];

		isSaturatedQuoteTests.forEach(test => {
			runIsSaturatedQuoteTest(test.description, test.config, test.expected);
		});
	});

	describe('applySaturationHaircut', () => {
		const runApplySaturationHaircutTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = applySaturationHaircut(config.amount);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const applySaturationHaircutTests = [
			{
				description: 'reduces the amount by one basis point',
				config: { amount: '10000' },
				expected: { result: '9999' }
			},
			{
				description: 'rounds the reduced amount down',
				config: { amount: '10001' },
				expected: { result: '9999' }
			},
			{
				description: 'handles large amounts without precision loss',
				config: { amount: '126974974899' },
				expected: { result: '126962277401' }
			},
			{
				description: 'returns zero for dust amounts below the haircut resolution',
				config: { amount: '1' },
				expected: { result: '0' }
			}
		];

		applySaturationHaircutTests.forEach(test => {
			runApplySaturationHaircutTest(test.description, test.config, test.expected);
		});
	});
});
