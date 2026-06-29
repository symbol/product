import { transactionToNem } from '../../src/utils';
import { transactionToNemCases } from '../__fixtures__/local/nem-transactions';
import { networkProperties } from '../__fixtures__/local/network';

describe('utils/transaction-to-nem', () => {
	it.each(transactionToNemCases)('maps $name to a NEM SDK transaction', ({ transaction, expected }) => {
		// Arrange:
		const config = { networkProperties };

		// Act:
		const result = transactionToNem(transaction, config);

		// Assert:
		expect(result.toJson()).toStrictEqual(expected);
	});
});
