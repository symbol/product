import { transactionToEthereum } from '../../src/utils/transaction-to-ethereum';
import { ethereumTransactions, walletTransactions } from '../__fixtures__/local/transactions';
import { currentNetworkIdentifier } from '../__fixtures__/local/wallet';

describe('utils/transaction-to-ethereum', () => {
	it('converts transactions to ethers format (array-driven, no mocks)', () => {
		// Arrange:
		const networkIdentifier = currentNetworkIdentifier;
		const inputs = walletTransactions;
		const expected = ethereumTransactions;

		// Act & Assert:
		inputs.forEach((tx, index) => {
			const result = transactionToEthereum(tx, { networkIdentifier });
			expect(result).toStrictEqual(expected[index]);
		});
	});
});

