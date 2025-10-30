import { transactionFromDTO } from '../../src/utils';
import { 
	bridgeTransactionResponse,
	erc20TransactionResponse,
	etherTransactionResponse
} from '../__fixtures__/api/transaction';
import { blocks } from '../__fixtures__/local/block';
import { networkProperties } from '../__fixtures__/local/network';
import { tokenInfos } from '../__fixtures__/local/token';
import { 
	bridgeTransaction,
	erc20Transaction,
	etherTransaction
} from '../__fixtures__/local/transactions';
import { currentAccount } from '../__fixtures__/local/wallet';

describe('utils/transaction-from-dto', () => {
	it('maps transactions from API response', () => {
		// Arrange:
		const transactionOptions = {
			networkProperties,
			currentAccount,
			tokenInfos,
			blocks
		};
		const input = [
			etherTransactionResponse,
			erc20TransactionResponse,
			bridgeTransactionResponse
		];
		const expectedResult = [
			etherTransaction,
			erc20Transaction,
			bridgeTransaction
		];

		// Act:
		const result = input.map(transactionDTO => transactionFromDTO(transactionDTO, transactionOptions));

		// Assert:
		result.map((transaction, index) => expect(transaction).toStrictEqual(expectedResult[index]));
	});
});
