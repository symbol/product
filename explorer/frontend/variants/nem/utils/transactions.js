import { NEM_TRANSACTION_GROUP } from '../constants';
import { TRANSACTION_TYPE } from '../transaction/transaction-types';

/**
 * Checks whether a transaction is waiting for cosignatures before it can confirm. A NEM multisig
 * transaction stays in the unconfirmed pool until the required cosignatures are collected.
 * @param {{ type: string, group: string }} transaction - the transaction to evaluate.
 * @returns {boolean} true when the transaction is awaiting cosignatures.
 */
export const isTransactionAwaitingSignatures = transaction =>
	transaction.group === NEM_TRANSACTION_GROUP.UNCONFIRMED && transaction.type === TRANSACTION_TYPE.MULTISIG;
