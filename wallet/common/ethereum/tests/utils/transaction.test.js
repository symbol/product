import {
	createFee,
	isIncomingTransaction,
	isOutgoingTransaction,
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
});

