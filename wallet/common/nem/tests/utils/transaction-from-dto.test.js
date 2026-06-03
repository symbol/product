import { transactionFromDTO } from '../../src/utils';
import { transactionDTOs } from '../__fixtures__/api/transaction-dtos';
import { mosaicInfos } from '../__fixtures__/local/mosaic';
import { networkProperties } from '../__fixtures__/local/network';
import { walletTransactions } from '../__fixtures__/local/transactions';
import { currentAccount } from '../__fixtures__/local/wallet';

describe('utils/transaction-from-dto', () => {
	it('maps transactions from API response', () => {
		// Arrange:
		const transactionOptions = {
			networkProperties,
			currentAccount,
			mosaicInfos
		};

		// Act:
		const result = transactionDTOs.map(transactionDTO => transactionFromDTO(transactionDTO, transactionOptions));

		// Assert:
		result.forEach((transaction, index) => expect(transaction).toStrictEqual(walletTransactions[index]));
	});
});
