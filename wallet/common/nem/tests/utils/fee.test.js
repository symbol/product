import { TransactionType } from '../../src/constants';
import {
	calculateTotalTransactionFee,
	calculateTransactionFee,
	createTransactionFee,
	createTransactionFeeTiers
} from '../../src/utils';
import {
	cosignature,
	importanceTransfer,
	mosaicDefinition,
	mosaicSupplyChange,
	multisigModification,
	multisigTransfer,
	namespaceRoot
} from '../__fixtures__/local/nem-transactions';
import { networkProperties } from '../__fixtures__/local/network';
import { accounts } from '../__fixtures__/local/wallet';

// Fixtures

const { mosaicId, name, divisibility } = networkProperties.networkCurrency;
const recipientAddress = accounts.bob.address;

const nativeMosaic = amount => ({ id: mosaicId, name, amount, divisibility });
const createTransfer = props => ({ type: TransactionType.TRANSFER, recipientAddress, ...props });
const createMessage = byteLength => ({ payload: '00'.repeat(byteLength), native: { type: 1 } });

// Mosaics exercising the per-mosaic fee branches: a flat-priced small-business mosaic, a supply-bearing
// mosaic priced with the full formula, one transferring (near) the whole XEM range to hit the cap, and one
// without supply metadata that cannot be priced.
const smallBusinessMosaic = { id: 'biz.token', amount: '5', divisibility: 0, supply: 10000 };
const supplyBearingMosaic = { id: 'test.token', amount: '5', divisibility: 2, supply: 10000 };
const subNamespaceMosaic = { id: 'makoto.metals.silver', amount: '5', divisibility: 2, supply: 10000 };
const maxSupplyMosaic = { id: 'test.token', amount: '8999999999', divisibility: 6, supply: 8999999999 };
const unpriceableMosaic = { id: 'test.token', amount: '5', divisibility: 2 };

const multiMosaicTransfer = createTransfer({
	mosaics: [
		{ id: 'a.token', amount: '5', divisibility: 0, supply: 1000 },
		{ id: 'b.token', amount: '3', divisibility: 0, supply: 1000 }
	]
});

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

		// A transfer is priced as the XEM-amount fee (0.05 XEM per commenced 10,000 XEM, capped at 1.25) plus a
		// message fee (0.05 per commenced 32-byte chunk) plus a per-mosaic fee. Every other type pays a flat
		// base fee of 0.15 XEM, except aggregate (multisig account) modification, which is 0.5 XEM.
		const calculateTransactionFeeTests = [
			{
				description: 'prices a small XEM transfer at a single fee unit',
				config: { transaction: createTransfer({ mosaics: [nativeMosaic('10')] }) },
				expected: { fee: '0.05' }
			},
			{
				description: 'prices a 45,000 XEM transfer across several fee steps',
				config: { transaction: createTransfer({ mosaics: [nativeMosaic('45000')] }) },
				expected: { fee: '0.2' }
			},
			{
				description: 'caps the XEM-amount fee at 1.25 XEM',
				config: { transaction: createTransfer({ mosaics: [nativeMosaic('500000')] }) },
				expected: { fee: '1.25' }
			},
			{
				description: 'charges the minimum fee unit for a transfer carrying no native XEM',
				config: { transaction: createTransfer({ mosaics: [] }) },
				expected: { fee: '0.05' }
			},
			{
				description: 'adds a one-chunk message fee for a short message',
				config: { transaction: createTransfer({ mosaics: [nativeMosaic('10')], message: createMessage(10) }) },
				expected: { fee: '0.1' }
			},
			{
				description: 'adds a two-chunk message fee for a 33-byte message',
				config: { transaction: createTransfer({ mosaics: [nativeMosaic('10')], message: createMessage(33) }) },
				expected: { fee: '0.15' }
			},
			{
				description: 'prices a message-only transfer at the minimum fee unit plus the message fee',
				config: { transaction: createTransfer({ mosaics: [], message: createMessage(10) }) },
				expected: { fee: '0.1' }
			},
			{
				description: 'charges a flat per-mosaic fee for a small-business mosaic',
				config: { transaction: createTransfer({ mosaics: [smallBusinessMosaic] }) },
				expected: { fee: '0.05' }
			},
			{
				description: 'prices a transferred mosaic with the full per-mosaic fee formula',
				config: { transaction: createTransfer({ mosaics: [supplyBearingMosaic] }) },
				expected: { fee: '0.35' }
			},
			{
				description: 'prices a transferred sub-namespace mosaic with the full per-mosaic fee formula',
				config: { transaction: createTransfer({ mosaics: [subNamespaceMosaic] }) },
				expected: { fee: '0.35' }
			},
			{
				description: 'caps a high-value mosaic transfer at the per-mosaic maximum',
				config: { transaction: createTransfer({ mosaics: [maxSupplyMosaic] }) },
				expected: { fee: '1.25' }
			},
			{
				description: 'sums the per-mosaic fee across multiple non-native mosaics',
				config: { transaction: multiMosaicTransfer },
				expected: { fee: '0.1' }
			},
			{
				description: 'prices a multisig wrapper at the wrapper fee only',
				config: { transaction: multisigTransfer },
				expected: { fee: '0.15' }
			},
			{
				description: 'prices a multisig account modification at the flat aggregate fee',
				config: { transaction: multisigModification },
				expected: { fee: '0.5' }
			},
			{
				description: 'prices an importance transfer (account key link) at the base fee',
				config: { transaction: importanceTransfer },
				expected: { fee: '0.15' }
			},
			{
				description: 'prices a multisig cosignature at the base fee',
				config: { transaction: cosignature },
				expected: { fee: '0.15' }
			},
			{
				description: 'prices a namespace registration at the base fee, with rental paid separately',
				config: { transaction: namespaceRoot },
				expected: { fee: '0.15' }
			},
			{
				description: 'prices a mosaic definition at the base fee, with creation paid separately',
				config: { transaction: mosaicDefinition },
				expected: { fee: '0.15' }
			},
			{
				description: 'prices a mosaic supply change at the base fee',
				config: { transaction: mosaicSupplyChange },
				expected: { fee: '0.15' }
			}
		];

		calculateTransactionFeeTests.forEach(test => runCalculateTransactionFeeTest(test.description, test.config, test.expected));

		it('throws when a transferred mosaic has no resolvable supply', () => {
			// Arrange:
			const transaction = createTransfer({ mosaics: [unpriceableMosaic] });

			// Act & Assert:
			expect(() => calculateTransactionFee(transaction, networkProperties)).toThrow('unable to find fee information for test:token');
		});
	});

	describe('calculateTotalTransactionFee', () => {
		it('equals the transaction fee for a non-multisig transaction', () => {
			// Act:
			const result = calculateTotalTransactionFee(createTransfer({ mosaics: [nativeMosaic('10')] }), networkProperties);

			// Assert:
			expect(result).toBe('0.05');
		});

		it('adds the inner transaction fee to the wrapper fee for a multisig transfer', () => {
			// Act:
			const result = calculateTotalTransactionFee(multisigTransfer, networkProperties);

			// Assert: 0.15 XEM wrapper fee plus the 0.05 XEM inner transfer fee.
			expect(result).toBe('0.2');
		});
	});
});
