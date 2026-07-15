import { NEM_MESSAGE_TYPE, NEM_TRANSACTION_GROUP } from '../constants';
import { MESSAGE_TYPE, TRANSACTION_TYPE } from '@/app/constants';
import { decodeTransactionMessage } from '@/app/utils/common';

/**
 * Formats a NEM transfer message for display.
 * @param {number} messageType - NEM transfer message type.
 * @param {string} payload - Raw message payload hex string.
 * @returns {{ type: string, text: string }|null} Formatted message (type is a MESSAGE_TYPE value).
 */
export const formatTransferMessage = (messageType, payload) => {
	if (!payload)
		return null;

	if (messageType !== NEM_MESSAGE_TYPE.PLAIN)
		return { type: MESSAGE_TYPE.ENCRYPTED, text: payload };

	const normalizedPayload = payload.toLowerCase();

	if (normalizedPayload.startsWith('fe'))
		return { type: MESSAGE_TYPE.RAW, text: `HEX: ${payload.slice(2)}` };

	return { type: MESSAGE_TYPE.PLAIN, text: decodeTransactionMessage(payload) };
};

/**
 * Checks whether a transaction is waiting for cosignatures before it can confirm. A NEM multisig
 * transaction stays in the unconfirmed pool until the required cosignatures are collected.
 * @param {{ type: string, group: string }} transaction - the transaction to evaluate.
 * @returns {boolean} true when the transaction is awaiting cosignatures.
 */
export const isTransactionAwaitingSignatures = transaction =>
	transaction.group === NEM_TRANSACTION_GROUP.UNCONFIRMED && transaction.type === TRANSACTION_TYPE.MULTISIG;
