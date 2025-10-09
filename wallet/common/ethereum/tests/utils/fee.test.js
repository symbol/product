import { 
	createFee,
	createTransactionFeeMultipliers,
	createTransactionFeeTiers
} from '../../src/utils/fee';

describe('utils/fee', () => {
	describe('createTransactionFeeMultipliers', () => {
		it('computes EIP-1559 fee tiers from fee history (median priority fees and base fee multipliers)', () => {
			// Arrange:
			const currencyDivisibility = 18; // ETH
			const feeHistory = {
				baseFeePerGas: [
					'0x0',
					'0x174876e800' // 100 gwei in wei
				],
				// reward percentiles per block [p10, p50, p90]
				reward: [
					['0x3b9aca00', '0x77359400', '0xb2d05e00'], // [1g, 2g, 3g]
					['0x77359400', '0xb2d05e00', '0xee6b2800'], // [2g, 3g, 4g]
					['0xb2d05e00', '0xee6b2800', '0x12a05f200'] // [3g, 4g, 5g]
				]
			};

			// Act:
			const result = createTransactionFeeMultipliers(currencyDivisibility, feeHistory);

			// Assert:
			// nextBaseFee = 100 gwei; multipliers: 1.2 / 1.5 / 2.0
			// priority medians: 2g / 3g / 4g
			// maxFeePerGas = floor(nextBaseFee * multiplier) + priority
			const expected = {
				slow:   { maxPriorityFeePerGas: '0.000000002', maxFeePerGas: '0.000000122' },
				medium: { maxPriorityFeePerGas: '0.000000003', maxFeePerGas: '0.000000153' },
				fast:   { maxPriorityFeePerGas: '0.000000004', maxFeePerGas: '0.000000204' }
			};
			expect(result).toStrictEqual(expected);
		});

		it('falls back to default priority fees when fee history is missing', () => {
			// Arrange:
			const currencyDivisibility = 18;
			const feeHistory = {}; // no baseFeePerGas or reward

			// Act:
			const result = createTransactionFeeMultipliers(currencyDivisibility, feeHistory);

			// Assert:
			// Fallback priority fees: 1g / 2g / 3g; base fee unknown -> 0
			const expected = {
				slow:   { maxPriorityFeePerGas: '0.000000001', maxFeePerGas: '0.000000001' },
				medium: { maxPriorityFeePerGas: '0.000000002', maxFeePerGas: '0.000000002' },
				fast:   { maxPriorityFeePerGas: '0.000000003', maxFeePerGas: '0.000000003' }
			};
			expect(result).toStrictEqual(expected);
		});
	});

	describe('createFee', () => {
		it('builds a fee object with token cost derived from gasLimit and maxFeePerGas', () => {
			// Arrange:
			const currencyDivisibility = 18;
			const feeHistory = {
				baseFeePerGas: ['0x174876e800'], // 100 gwei
				reward: [
					['0x77359400', '0xb2d05e00', '0xee6b2800'] // [2g, 3g, 4g]
				]
			};
			const gasLimit = '21000';
			const networkCurrency = {
				id: 'ETH',
				name: 'Ethereum',
				divisibility: currencyDivisibility
			};

			// Act:
			const multipliers = createTransactionFeeMultipliers(currencyDivisibility, feeHistory);
			const result = createFee(multipliers.medium, gasLimit, networkCurrency);

			// Assert:
			const expected = {
				gasLimit: '21000',
				maxFeePerGas: '0.000000153',
				maxPriorityFeePerGas: '0.000000003',
				token: {
					id: 'ETH',
					name: 'Ethereum',
					divisibility: 18,
					amount: '0.003213'
				}
			};
			expect(result).toStrictEqual(expected);
		});
	});

	describe('createTransactionFeeTiers', () => {
		it('creates fee tiers from provided transaction fee multipliers', () => {
			// Arrange:
			const divisibility = 18;
			const gasLimit = '21000';
			const feeHistory = {
				baseFeePerGas: ['0x174876e800'], // 100 gwei
				reward: [
					['0x3b9aca00', '0x77359400', '0xb2d05e00'] // [1g, 2g, 3g]
				]
			};
			const transactionFees = createTransactionFeeMultipliers(divisibility, feeHistory);
			const networkProperties = {
				networkCurrency: {
					id: 'ETH',
					name: 'Ethereum',
					divisibility
				},
				transactionFees
			};

			// Act:
			const tiers = createTransactionFeeTiers(networkProperties, gasLimit);

			// Assert:
			const expected = {
				slow: {
					gasLimit: '21000',
					maxFeePerGas: '0.000000121',
					maxPriorityFeePerGas: '0.000000001',
					token: {
						id: 'ETH',
						name: 'Ethereum',
						divisibility: 18,
						amount: '0.002541'
					}
				},
				medium: {
					gasLimit: '21000',
					maxFeePerGas: '0.000000152',
					maxPriorityFeePerGas: '0.000000002',
					token: {
						id: 'ETH',
						name: 'Ethereum',
						divisibility: 18,
						amount: '0.003192'
					}
				},
				fast: {
					gasLimit: '21000',
					maxFeePerGas: '0.000000203',
					maxPriorityFeePerGas: '0.000000003',
					token: {
						id: 'ETH',
						name: 'Ethereum',
						divisibility: 18,
						amount: '0.004263'
					}
				}
			};
			expect(tiers).toStrictEqual(expected);
		});
	});
});
