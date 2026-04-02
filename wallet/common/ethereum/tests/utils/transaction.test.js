import {
	createFee,
	isIncomingTransaction,
	isOutgoingTransaction,
	normalizeTransactionHash,
	signTransaction
} from '../../src/utils';
import { networkCurrency } from '../__fixtures__/local/network';
import { signedTransactions, walletTransactions } from '../__fixtures__/local/transactions';
import { currentNetworkIdentifier, walletStorageAccounts } from '../__fixtures__/local/wallet';

describe('utils/transaction', () => {
	describe('isOutgoingTransaction', () => {
		it('returns true when signer matches current account', () => {
			const account = walletStorageAccounts[currentNetworkIdentifier][0];
			const tx = {
				signerAddress: account.address,
				recipientAddress: walletStorageAccounts[currentNetworkIdentifier][1].address
			};

			expect(isOutgoingTransaction(tx, { address: account.address })).toBe(true);
		});

		it('returns false when signer differs from current account', () => {
			const account = walletStorageAccounts[currentNetworkIdentifier][0];
			const tx = {
				signerAddress: walletStorageAccounts[currentNetworkIdentifier][1].address,
				recipientAddress: account.address
			};

			expect(isOutgoingTransaction(tx, { address: account.address })).toBe(false);
		});
	});

	describe('isIncomingTransaction', () => {
		it('returns true when recipient matches current account', () => {
			const account = walletStorageAccounts[currentNetworkIdentifier][0];
			const tx = {
				signerAddress: walletStorageAccounts[currentNetworkIdentifier][1].address,
				recipientAddress: account.address
			};

			expect(isIncomingTransaction(tx, { address: account.address })).toBe(true);
		});

		it('returns false when recipient differs from current account', () => {
			const account = walletStorageAccounts[currentNetworkIdentifier][0];
			const tx = {
				signerAddress: account.address,
				recipientAddress: walletStorageAccounts[currentNetworkIdentifier][1].address
			};

			expect(isIncomingTransaction(tx, { address: account.address })).toBe(false);
		});
	});

	describe('createFee', () => {
		it('creates fee object and computes totalAmount via helper', () => {
			const feeMultiplier = { maxFeePerGas: '3', maxPriorityFeePerGas: '1' };
			const gasLimit = '1000';

			const fee = createFee(feeMultiplier, gasLimit, networkCurrency);

			expect(fee).toEqual({
				gasLimit,
				maxFeePerGas: '3',
				maxPriorityFeePerGas: '1',
				token: {
					...networkCurrency,
					amount: '3000'
				}
			});
		});
	});

	describe('signTransaction', () => {
		it('signs transaction and returns dto + hash', async () => {
			const { privateKey } = walletStorageAccounts[currentNetworkIdentifier][0];
			const inputs = walletTransactions;
			const expectedOutputs = signedTransactions;

			// Act & Assert:
			for (let i = 0; i < inputs.length; i++) {
				const result = await signTransaction(currentNetworkIdentifier, inputs[i], privateKey);

				expect(result).toStrictEqual(expectedOutputs[i]);
			}
		});
	});

	describe('normalizeTransactionHash', () => {
		it('prepends 0x and lowercases hash without prefix', () => {
			// Arrange:
			const hash = 'A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2';
			const expectedResult = '0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

			// Act:
			const result = normalizeTransactionHash(hash);

			// Assert:
			expect(result).toBe(expectedResult);
		});

		it('lowercases hash that already has 0x prefix', () => {
			// Arrange:
			const hash = '0xA1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2';
			const expectedResult = '0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

			// Act:
			const result = normalizeTransactionHash(hash);

			// Assert:
			expect(result).toBe(expectedResult);
		});

		it('returns already normalized hash unchanged', () => {
			// Arrange:
			const hash = '0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

			// Act:
			const result = normalizeTransactionHash(hash);

			// Assert:
			expect(result).toBe(hash);
		});

		it('throws TypeError when hash is not a string', () => {
			// Act & Assert:
			expect(() => normalizeTransactionHash(123)).toThrow(TypeError);
			expect(() => normalizeTransactionHash(null)).toThrow(TypeError);
			expect(() => normalizeTransactionHash(undefined)).toThrow(TypeError);
		});
	});
});

