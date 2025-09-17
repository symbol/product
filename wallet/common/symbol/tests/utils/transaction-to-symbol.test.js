import { symbolTransactionFromPayload, transactionToSymbol } from '../../src/utils';
import { networkProperties } from '../__fixtures__/local/network';
import { payloads } from '../__fixtures__/local/payloads';
import { walletTransactions } from '../__fixtures__/local/transactions';
import { currentAccount } from '../__fixtures__/local/wallet';

describe('utils/transaction-to-symbol', () => {
	it('maps transactions to symbol object', () => {
		// Arrange:
		const expectedSymbolTransactions = payloads.map(item => symbolTransactionFromPayload(item.payload));
		const transactionOptions = {
			networkIdentifier: networkProperties.networkIdentifier,
			currentAccount
		};

		// Act:
		const result = walletTransactions.map(transaction => transactionToSymbol(transaction, transactionOptions));

		// Assert:
		result.map((transaction, index) => expect(transaction.toJson()).toStrictEqual(expectedSymbolTransactions[index].toJson()));
	});
});
