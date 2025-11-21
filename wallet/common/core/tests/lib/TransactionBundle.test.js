import { TransactionBundle } from '../../src/lib/models/TransactionBundle';

const createTransaction = (index = 1, overrides = {}) => ({
	type: 'transfer',
	signerPublicKey: `pubkey-${index}`,
	signerAddress: `address-${index}`,
	fee: 0,
	...overrides
});
const createSignedTransaction = (index = 1) => ({
	dto: { payload: `payload-${index}` },
	hash: `hash-${index}`
});
const createFeeTiers = (slow, medium, fast) => ({ slow, medium, fast });

describe('TransactionBundle', () => {
	describe('constructor', () => {
		it('creates an instance with transactions and metadata', () => {
			// Arrange:
			const transactions = [createTransaction(1), createSignedTransaction(1)];
			const metadata = { note: 'test metadata', purpose: 'unit' };

			// Act:
			const bundle = new TransactionBundle(transactions, metadata);

			// Assert:
			expect(bundle.transactions).toStrictEqual(transactions);
			expect(bundle.metadata).toStrictEqual(metadata);
		});

		it('throws when constructed with empty transactions array', () => {
			// Arrange:
			const transactions = [];

			// Act & Assert:
			expect(() => new TransactionBundle(transactions)).toThrow('Transaction bundle must contain at least one transaction.');
		});

		it('throws when constructed with non-array transactions', () => {
			// Arrange:
			const transactions = null;

			// Act & Assert:
			expect(() => new TransactionBundle(transactions)).toThrow('Transaction bundle must contain at least one transaction.');
		});
	});

	describe('get isComposite', () => {
		it('returns false for single transaction', () => {
			// Arrange:
			const transactions = [createTransaction(1)];
			const bundle = new TransactionBundle(transactions);

			// Act & Assert:
			expect(bundle.isComposite).toBe(false);
		});

		it('returns true for multiple transactions', () => {
			// Arrange:
			const transactions = [createTransaction(1), createTransaction(2)];
			const bundle = new TransactionBundle(transactions);

			// Act & Assert:
			expect(bundle.isComposite).toBe(true);
		});
	});

	describe('get firstTransaction', () => {
		it('returns the first transaction', () => {
			// Arrange:
			const firstTx = createTransaction(1);
			const secondTx = createTransaction(2);
			const bundle = new TransactionBundle([firstTx, secondTx]);

			// Act & Assert:
			expect(bundle.firstTransaction).toStrictEqual(firstTx);
		});
	});

	describe('applyFeeTier()', () => {
		const runApplyFeeTierTest = async (config, expected) => {
			// Arrange:
			const { transactions, fees, level } = config;
			const bundle = new TransactionBundle(transactions);

			// Act:
			bundle.applyFeeTier(fees, level);

			// Assert:
			expect(bundle.transactions).toStrictEqual(expected.transactions);
		};

		it('applies slow fees to each transaction', async () => {
			// Arrange:
			const transactions = [createTransaction(1), createTransaction(2)];
			const fees = [createFeeTiers(10, 20, 30), createFeeTiers(5, 15, 25)];
			const level = 'slow';
			const expectedTransactions = [
				{ ...transactions[0], fee: fees[0][level] },
				{ ...transactions[1], fee: fees[1][level] }
			];

			// Act & Assert:
			await runApplyFeeTierTest(
				{ transactions, fees, level },
				{ transactions: expectedTransactions }
			);
		});

		it('applies medium fees to each transaction', async () => {
			// Arrange:
			const transactions = [createTransaction(3), createTransaction(4)];
			const fees = [createFeeTiers(1, 2, 3), createFeeTiers(7, 8, 9)];
			const level = 'medium';
			const expectedTransactions = [
				{ ...transactions[0], fee: fees[0][level] },
				{ ...transactions[1], fee: fees[1][level] }
			];

			// Act & Assert:
			await runApplyFeeTierTest(
				{ transactions, fees, level },
				{ transactions: expectedTransactions }
			);
		});

		it('applies fast fees to each transaction', async () => {
			// Arrange:
			const transactions = [createTransaction(5), createTransaction(6), createTransaction(7)];
			const fees = [createFeeTiers(11, 22, 33), createFeeTiers(44, 55, 66), createFeeTiers(77, 88, 99)];
			const level = 'fast';
			const expectedTransactions = [
				{ ...transactions[0], fee: fees[0][level] },
				{ ...transactions[1], fee: fees[1][level] },
				{ ...transactions[2], fee: fees[2][level] }
			];

			// Act & Assert:
			await runApplyFeeTierTest(
				{ transactions, fees, level },
				{ transactions: expectedTransactions }
			);
		});

		it('throws when number of fee tiers does not match transactions length', () => {
			// Arrange:
			const transactions = [createTransaction(1), createTransaction(2)];
			const fees = [createFeeTiers(1, 2, 3)];
			const bundle = new TransactionBundle(transactions);

			// Act & Assert:
			expect(() => bundle.applyFeeTier(fees, 'fast'))
				.toThrow('Failed to apply transaction fees. Mismatched number of transactions and fees.');
		});
	});

	describe('toJSON()', () => {
		it('returns a correct JSON representation', () => {
			// Arrange:
			const transactions = [createTransaction(1), createSignedTransaction(2)];
			const metadata = { tag: 'export', batch: 1 };
			const bundle = new TransactionBundle(transactions, metadata);
			const expectedJson = { transactions, metadata };

			// Act:
			const json = bundle.toJSON();

			// Assert:
			expect(json).toStrictEqual(expectedJson);
		});
	});

	describe('fromJSON()', () => {
		it('creates an equivalent TransactionBundle', () => {
			// Arrange:
			const transactions = [createTransaction(1), createTransaction(2)];
			const metadata = { info: 'roundtrip' };
			const json = { transactions, metadata };

			// Act:
			const bundle = TransactionBundle.fromJSON(json);

			// Assert:
			expect(bundle.transactions).toStrictEqual(transactions);
			expect(bundle.metadata).toStrictEqual(metadata);
		});
	});
});
