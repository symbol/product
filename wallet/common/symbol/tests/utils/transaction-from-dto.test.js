import { transactionFromDTO } from '../../src/utils';
import { transactionPageResponse } from '../__fixtures__/api/transaction-page-response';
import { unconfirmedTransactionPageResponse } from '../__fixtures__/api/unconfirmed-transaction-page-response';
import { effectiveTransactionFees } from '../__fixtures__/local/effective-fees';
import { mosaicInfos } from '../__fixtures__/local/mosaic';
import { namespaceNames } from '../__fixtures__/local/namespace';
import { networkProperties } from '../__fixtures__/local/network';
import { walletTransactions } from '../__fixtures__/local/transactions';
import { unconfirmedWalletTransactions } from '../__fixtures__/local/unconfirmed-transactions';
import { currentAccount } from '../__fixtures__/local/wallet';

const transactionOptions = {
	networkProperties,
	currentAccount,
	mosaicInfos,
	namespaceNames,
	resolvedAddresses: {}
};

describe('utils/transaction-from-dto', () => {
	it('maps confirmed transactions from API response', () => {
		// Arrange:
		// The `walletTransactions` fee is the declared maximum, the mapper reports the fee the network charged.
		const expectedTransactions = walletTransactions.map((transaction, index) => ({
			...transaction,
			fee: {
				token: {
					...transaction.fee.token,
					amount: effectiveTransactionFees[index]
				}
			}
		}));

		// Act:
		const result = transactionPageResponse.map(transactionDTO => transactionFromDTO(transactionDTO, transactionOptions));

		// Assert:
		result.map((transaction, index) => expect(transaction).toStrictEqual(expectedTransactions[index]));
	});

	it('maps unconfirmed transactions from API response', () => {
		// Act:
		const result = unconfirmedTransactionPageResponse
			.map(transactionDTO => transactionFromDTO(transactionDTO, transactionOptions));

		// Assert:
		result.map((transaction, index) => expect(transaction).toStrictEqual(unconfirmedWalletTransactions[index]));
	});
});
