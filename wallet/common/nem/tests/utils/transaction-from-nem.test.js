import { transactionFromNem, transactionToNem } from '../../src/utils';
import { transactionFromNemCases } from '../__fixtures__/local/nem-transactions';
import { networkProperties } from '../__fixtures__/local/network';
import { accounts } from '../__fixtures__/local/wallet';

// Mosaic info resolving the non-native 'test.token' mosaic to its relative amount and metadata.
const MOSAIC_INFOS = {
	'test.token': { id: 'test.token', name: 'Test Token', divisibility: 2, supply: 1000 }
};

describe('utils/transaction-from-nem', () => {
	it.each(transactionFromNemCases)('maps $name from a NEM SDK transaction', ({ transaction, expected }) => {
		// Arrange:
		const config = { networkProperties, currentAccount: accounts.alice, mosaicInfos: MOSAIC_INFOS };
		const nemTransaction = transactionToNem(transaction, { networkProperties });

		// Act:
		const result = transactionFromNem(nemTransaction, config);

		// Assert:
		expect(result).toStrictEqual(expected);
	});
});
