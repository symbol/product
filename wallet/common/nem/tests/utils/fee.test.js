import { TransactionType } from '../../src/constants';
import { calculateTransactionFee, createTransactionFee, createTransactionFeeTiers } from '../../src/utils';
import { networkProperties } from '../__fixtures__/local/network';

// Fixtures

const { mosaicId, name, divisibility } = networkProperties.networkCurrency;
const nativeMosaic = amount => ({ id: mosaicId, name, amount, divisibility });

// A small-business mosaic (divisibility 0, supply ≤ 10,000) — priced at the flat per-mosaic fee.
const smallBusinessMosaic = { id: 'biz.token', amount: '5', divisibility: 0, supply: 10000 };

// A non-native mosaic carrying supply/divisibility metadata, priced with the full per-mosaic fee formula.
const supplyBearingMosaic = { id: 'test.token', amount: '5', divisibility: 2, supply: 10000 };

// A mosaic at the top of the valid NEM range (entire max supply transferred). Its quantity products
// (supply · 10^divisibility ≈ 9e15) sit at the edge of Number's exact-integer range, so the BigInt
// formula is what keeps the result exact here.
const maxSupplyMosaic = { id: 'test.token', amount: '8999999999', divisibility: 6, supply: 8999999999 };

// A mosaic carrying a negative (directed) amount — rejected by the fee calculator.
const negativeMosaic = { id: 'test.token', amount: '-5', divisibility: 2, supply: 10000 };

const NEGATIVE_AMOUNT_ERROR = 'Cannot calculate a fee for a negative amount';

// Transfers carrying a 10-byte and a 33-byte message payload (hex) → one and two 32-byte fee chunks.
const transferWithShortMessage = {
	type: TransactionType.TRANSFER,
	mosaics: [nativeMosaic('10')],
	message: { payload: '00'.repeat(10) }
};
const transferWithLongMessage = {
	type: TransactionType.TRANSFER,
	mosaics: [nativeMosaic('10')],
	message: { payload: '00'.repeat(33) }
};

describe('utils/fee', () => {
	describe('createTransactionFee', () => {
		it('builds a fee token descriptor from the network currency', () => {
			// Arrange:
			const amount = '0.15';
			const expectedFee = { token: { amount, divisibility, id: mosaicId, name } };

			// Act:
			const result = createTransactionFee(networkProperties, amount);

			// Assert:
			expect(result).toStrictEqual(expectedFee);
		});
	});

	describe('createTransactionFeeTiers', () => {
		it('builds equal fast, medium and slow tiers since NEM fees are deterministic', () => {
			// Arrange:
			const amount = '0.15';
			const tier = createTransactionFee(networkProperties, amount);
			const expectedTiers = { fast: tier, medium: tier, slow: tier };

			// Act:
			const result = createTransactionFeeTiers(networkProperties, amount);

			// Assert:
			expect(result).toStrictEqual(expectedTiers);
		});
	});

	describe('calculateTransactionFee', () => {
		const runCalculateTransactionFeeTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = calculateTransactionFee(config.transaction, networkProperties);

				// Assert:
				expect(result).toBe(expected.fee);
			});
		};

		const calculateTransactionFeeTests = [
			// Transfer — XEM-amount fee: 0.05 XEM per commenced 10,000 XEM, capped at 1.25 XEM.
			{
				description: 'prices a small XEM transfer at a single fee unit',
				config: { transaction: { type: TransactionType.TRANSFER, mosaics: [nativeMosaic('10')] } },
				expected: { fee: '0.05' }
			},
			{
				description: 'prices a 45,000 XEM transfer across tiers',
				config: { transaction: { type: TransactionType.TRANSFER, mosaics: [nativeMosaic('45000')] } },
				expected: { fee: '0.2' }
			},
			{
				description: 'caps the XEM-amount fee at 1.25 XEM',
				config: { transaction: { type: TransactionType.TRANSFER, mosaics: [nativeMosaic('500000')] } },
				expected: { fee: '1.25' }
			},
			{
				description: 'charges no XEM-amount fee for a transfer carrying no native XEM',
				config: { transaction: { type: TransactionType.TRANSFER } },
				expected: { fee: '0' }
			},
			// Transfer — message fee: 0.05 XEM per commenced 32-byte chunk.
			{
				description: 'adds a one-chunk message fee for a short message',
				config: { transaction: transferWithShortMessage },
				expected: { fee: '0.1' }
			},
			{
				description: 'adds a two-chunk message fee for a 33-byte message',
				config: { transaction: transferWithLongMessage },
				expected: { fee: '0.15' }
			},
			// Transfer — per-mosaic fee.
			{
				description: 'charges a flat per-mosaic fee for a mosaic without supply info',
				config: { transaction: { type: TransactionType.TRANSFER, mosaics: [{ id: 'test.token', amount: '5', divisibility: 2 }] } },
				expected: { fee: '0.05' }
			},
			{
				description: 'charges a flat per-mosaic fee for a small-business mosaic',
				config: { transaction: { type: TransactionType.TRANSFER, mosaics: [smallBusinessMosaic] } },
				expected: { fee: '0.05' }
			},
			{
				description: 'prices a transferred mosaic with the full per-mosaic fee formula',
				config: { transaction: { type: TransactionType.TRANSFER, mosaics: [supplyBearingMosaic] } },
				expected: { fee: '21.55' }
			},
			{
				description: 'prices a max-supply mosaic transfer exactly via BigInt',
				config: { transaction: { type: TransactionType.TRANSFER, mosaics: [maxSupplyMosaic] } },
				expected: { fee: '44999.95' }
			},
			{
				description: 'sums the per-mosaic fee across multiple non-native mosaics',
				config: {
					transaction: {
						type: TransactionType.TRANSFER,
						mosaics: [
							{ id: 'a.token', amount: '5', divisibility: 2 },
							{ id: 'b.token', amount: '3', divisibility: 2 }
						]
					}
				},
				expected: { fee: '0.1' }
			},
			// Non-transfer transaction types.
			{
				description: 'prices a multisig wrapper as the base fee plus the inner transaction fee',
				config: {
					transaction: {
						type: TransactionType.MULTISIG,
						innerTransaction: { type: TransactionType.TRANSFER, mosaics: [nativeMosaic('10')] }
					}
				},
				expected: { fee: '0.2' }
			},
			{
				description: 'prices a multisig account modification at the flat aggregate fee',
				config: { transaction: { type: TransactionType.MULTISIG_ACCOUNT_MODIFICATION } },
				expected: { fee: '0.5' }
			},
			{
				description: 'prices an account key link (importance transfer) at the base fee',
				config: { transaction: { type: TransactionType.ACCOUNT_KEY_LINK } },
				expected: { fee: '0.15' }
			},
			{
				description: 'prices a multisig cosignature at the base fee',
				config: { transaction: { type: TransactionType.MULTISIG_COSIGNATURE } },
				expected: { fee: '0.15' }
			},
			{
				description: 'prices a namespace registration at the base fee, with rental paid separately',
				config: { transaction: { type: TransactionType.NAMESPACE_REGISTRATION } },
				expected: { fee: '0.15' }
			},
			{
				description: 'prices a mosaic definition at the base fee, with creation paid separately',
				config: { transaction: { type: TransactionType.MOSAIC_DEFINITION } },
				expected: { fee: '0.15' }
			},
			{
				description: 'prices a mosaic supply change at the base fee',
				config: { transaction: { type: TransactionType.MOSAIC_SUPPLY_CHANGE } },
				expected: { fee: '0.15' }
			},
			{
				description: 'falls back to the base fee for an unknown transaction type',
				config: { transaction: { type: 999999 } },
				expected: { fee: '0.15' }
			}
		];

		calculateTransactionFeeTests.forEach(test => runCalculateTransactionFeeTest(test.description, test.config, test.expected));

		const negativeAmountTests = [
			{
				description: 'throws for a negative native XEM amount',
				transaction: { type: TransactionType.TRANSFER, mosaics: [nativeMosaic('-10')] }
			},
			{
				description: 'throws for a negative non-native mosaic amount',
				transaction: { type: TransactionType.TRANSFER, mosaics: [negativeMosaic] }
			}
		];

		negativeAmountTests.forEach(({ description, transaction }) => {
			it(description, () => {
				// Act & Assert:
				expect(() => calculateTransactionFee(transaction, networkProperties)).toThrow(NEGATIVE_AMOUNT_ERROR);
			});
		});
	});
});
