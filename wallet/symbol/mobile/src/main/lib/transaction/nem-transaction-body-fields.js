import { createTransferBodyFields, omitHiddenBodyFields } from './common-transaction-body-fields';
import { getSignedSupplyDelta } from '@/app/utils/transaction';
import { omit } from 'lodash';
import { TransactionType } from 'wallet-common-nem/src/constants';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */

/**
 * Creates body fields for the NEM transaction table.
 * @param {Transaction} transaction - The transaction object.
 * @returns {object} Fields to show in the table.
 */
export const createNemTransactionBodyFields = transaction => {
	const fields = omitHiddenBodyFields(transaction);

	switch (transaction.type) {
	case TransactionType.TRANSFER:
		return createTransferBodyFields(fields);

	case TransactionType.MOSAIC_SUPPLY_CHANGE:
		return {
			...omit(fields, ['action']),
			delta: getSignedSupplyDelta(transaction)
		};

	case TransactionType.MULTISIG_ACCOUNT_MODIFICATION:
		return omit(fields, ['publicKeyAdditions', 'publicKeyDeletions']);

	case TransactionType.MOSAIC_DEFINITION:
		return omit(fields, ['creatorPublicKey']);

	default:
		return fields;
	}
};
