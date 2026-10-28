import { createTransferBodyFields, omitHiddenBodyFields } from './common-transaction-body-fields';
import { getSignedSupplyDelta } from '@/app/utils/transaction';
import { omit } from 'lodash';
import { TransactionType } from 'wallet-common-symbol/src/constants';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */

const SYMBOL_HIDDEN_BODY_FIELDS = ['sourceAddress', 'lockedAmount', 'aggregateHash'];

/**
 * Creates body fields for the Symbol transaction table.
 * @param {Transaction} transaction - The transaction object.
 * @returns {object} Fields to show in the table.
 */
export const createSymbolTransactionBodyFields = transaction => {
	const fields = omit(omitHiddenBodyFields(transaction), SYMBOL_HIDDEN_BODY_FIELDS);

	switch (transaction.type) {
	case TransactionType.TRANSFER:
		return createTransferBodyFields(fields);

	case TransactionType.MOSAIC_SUPPLY_CHANGE:
		return {
			...omit(fields, ['action']),
			delta: getSignedSupplyDelta(transaction)
		};

	default:
		return fields;
	}
};
