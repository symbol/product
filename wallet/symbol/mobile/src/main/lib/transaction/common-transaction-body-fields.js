import { omit } from 'lodash';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */

const HIDDEN_BODY_FIELDS = [
	'hash',
	'id',
	'type',
	'amount',
	'fee',
	'status',
	'height',
	'innerTransactions',
	'cosignatures',
	'receivedCosignatures',
	'deadline',
	'timestamp',
	'signerPublicKey',
	'nonce'
];

/**
 * Removes the fields that is not supposed to be in the transaction body table.
 * @param {Transaction} transaction - The transaction object.
 * @returns {object} The fields object with the hidden fields omitted.
 */
export const omitHiddenBodyFields = transaction => omit(transaction, HIDDEN_BODY_FIELDS);

/**
 * The shared body fields creation function for transfer transaction.
 * Should be reused by most of the chains.
 * @param {object} fields - Transaction fields shown in the table.
 * @returns {object} Fields to show in the table.
 */
export const createTransferBodyFields = fields => {
	const { signerAddress, recipientAddress, ...rest } = fields;

	return {
		senderAddress: signerAddress,
		recipientAddress,
		...rest
	};
};
