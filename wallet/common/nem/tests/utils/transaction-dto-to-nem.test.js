import { TransactionType } from '../../src/constants';
import { calculateTransactionDTOHash } from '../../src/utils';
import { transactionDTOHashCases } from '../__fixtures__/api/testnet-transaction-dtos';
import { networkProperties } from '../__fixtures__/local/network';

describe('utils/transaction-dto-to-nem', () => {
	it.each(transactionDTOHashCases)('calculates the hash of $name', ({ transactionDTO, expected }) => {
		// Act:
		const result = calculateTransactionDTOHash(transactionDTO, networkProperties.networkIdentifier);

		// Assert:
		expect(result).toBe(expected);
	});

	it('returns null for an unsupported transaction type', () => {
		// Arrange:
		const transactionDTO = { transaction: { type: TransactionType.RESERVED } };

		// Act:
		const result = calculateTransactionDTOHash(transactionDTO, networkProperties.networkIdentifier);

		// Assert:
		expect(result).toBeNull();
	});
});
