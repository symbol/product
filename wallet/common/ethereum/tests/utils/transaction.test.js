import {
	decodePlainMessage,
	encodePlainMessage,
	isIncomingTransaction,
	isOutgoingTransaction,
	normalizeTransactionHash,
	signTransaction,
	signTransactionBundle
} from '../../src/utils';
import { signedTransactions, walletTransactions } from '../__fixtures__/local/transactions';
import { accounts, currentNetworkIdentifier } from '../__fixtures__/local/wallet';
import { TransactionBundle } from 'wallet-common-core';

// Constants

const networkIdentifier = currentNetworkIdentifier;
const { alice: signerAccount, bob: recipientAccount } = accounts;
const MESSAGE_TEXT = 'Good luck!';
const MESSAGE_PAYLOAD = '476f6f64206c75636b21';

// Human-readable labels for each walletTransactions entry, index-aligned with signedTransactions.
const transactionTypeLabels = [
	'native ETH transfer',
	'ERC-20 transfer',
	'ERC-20 bridge transfer',
	'Uniswap swap',
	'native Uniswap swap',
	'ERC-20 approval'
];

describe('utils/transaction', () => {
	describe('normalizeTransactionHash', () => {
		const runNormalizeTransactionHashTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = normalizeTransactionHash(config.hash);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const normalizedHash = '0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

		const normalizeTransactionHashTests = [
			{
				description: 'prepends 0x and lowercases a hash without a prefix',
				config: { hash: 'A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2' },
				expected: { result: normalizedHash }
			},
			{
				description: 'lowercases a hash that already has the 0x prefix',
				config: { hash: '0xA1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2' },
				expected: { result: normalizedHash }
			},
			{
				description: 'returns an already normalized hash unchanged',
				config: { hash: normalizedHash },
				expected: { result: normalizedHash }
			}
		];

		normalizeTransactionHashTests.forEach(test => runNormalizeTransactionHashTest(test.description, test.config, test.expected));

		it('throws a TypeError when the hash is not a string', () => {
			// Act & Assert:
			[123, null, undefined].forEach(input => expect(() => normalizeTransactionHash(input)).toThrow(TypeError));
		});
	});

	describe('isOutgoingTransaction', () => {
		const runIsOutgoingTransactionTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = isOutgoingTransaction(config.transaction, signerAccount);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const isOutgoingTransactionTests = [
			{
				description: 'returns true when the signer address matches the current account',
				config: { transaction: { signerAddress: signerAccount.address } },
				expected: { result: true }
			},
			{
				description: 'returns false when the signer address does not match the current account',
				config: { transaction: { signerAddress: recipientAccount.address } },
				expected: { result: false }
			}
		];

		isOutgoingTransactionTests.forEach(test => runIsOutgoingTransactionTest(test.description, test.config, test.expected));
	});

	describe('isIncomingTransaction', () => {
		const runIsIncomingTransactionTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = isIncomingTransaction(config.transaction, signerAccount);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const isIncomingTransactionTests = [
			{
				description: 'returns true when the recipient address matches the current account',
				config: { transaction: { recipientAddress: signerAccount.address } },
				expected: { result: true }
			},
			{
				description: 'returns false when the recipient address does not match the current account',
				config: { transaction: { recipientAddress: recipientAccount.address } },
				expected: { result: false }
			}
		];

		isIncomingTransactionTests.forEach(test => runIsIncomingTransactionTest(test.description, test.config, test.expected));
	});

	describe('encodePlainMessage', () => {
		it('encodes plain text as a hex message payload', () => {
			// Act:
			const result = encodePlainMessage(MESSAGE_TEXT);

			// Assert:
			expect(result).toBe(MESSAGE_PAYLOAD);
		});
	});

	describe('decodePlainMessage', () => {
		it('decodes a hex message payload back to plain text', () => {
			// Act:
			const result = decodePlainMessage(MESSAGE_PAYLOAD);

			// Assert:
			expect(result).toBe(MESSAGE_TEXT);
		});
	});

	describe('signTransaction', () => {
		const runSignTransactionTest = (description, config, expected) => {
			it(description, async () => {
				// Act:
				const result = await signTransaction(networkIdentifier, config.transaction, signerAccount.privateKey);

				// Assert:
				expect(result).toStrictEqual(expected.signedTransaction);
			});
		};

		const signTransactionTests = walletTransactions.map((transaction, index) => ({
			description: `signs a ${transactionTypeLabels[index]} into its dto and hash`,
			config: { transaction },
			expected: { signedTransaction: signedTransactions[index] }
		}));

		signTransactionTests.forEach(test => runSignTransactionTest(test.description, test.config, test.expected));
	});

	describe('signTransactionBundle', () => {
		it('signs every transaction in the bundle and preserves the metadata', async () => {
			// Arrange:
			const metadata = { type: 'default' };
			const transactionBundle = new TransactionBundle(walletTransactions, metadata);

			// Act:
			const result = await signTransactionBundle(networkIdentifier, transactionBundle, signerAccount.privateKey);

			// Assert:
			expect(result).toBeInstanceOf(TransactionBundle);
			expect(result.metadata).toStrictEqual(metadata);
			expect(result.transactions).toStrictEqual(signedTransactions);
		});
	});
});
