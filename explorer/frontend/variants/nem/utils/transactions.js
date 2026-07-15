import { TRANSACTION_TYPE } from '@/app/constants';
import { decodeTransactionMessage } from '@/app/utils/common';

const NEM_PLAIN_MESSAGE_TYPE = 1;

/**
 * Checks whether a transaction is waiting for cosignatures before it can confirm. A NEM multisig
 * transaction stays in the unconfirmed pool until the required cosignatures are collected.
 * @param {{ type: string, group: string }} transaction - the transaction to evaluate.
 * @returns {boolean} true when the transaction is awaiting cosignatures.
 */
export const isTransactionAwaitingSignatures = transaction =>
	transaction.group === 'unconfirmed' && transaction.type === TRANSACTION_TYPE.MULTISIG;

/**
 * Formats a NEM transfer message for display.
 * @param {number} messageType - NEM transfer message type.
 * @param {string} payload - Raw message payload hex string.
 * @returns {{ type: 'plain'|'hex'|'encrypted', text: string }|null} Formatted message.
 */
export const formatTransferMessage = (messageType, payload) => {
	if (!payload)
		return null;

	if (messageType !== NEM_PLAIN_MESSAGE_TYPE)
		return { type: 'encrypted', text: payload };

	const normalizedPayload = payload.toLowerCase();

	if (normalizedPayload.startsWith('fe'))
		return { type: 'hex', text: `HEX: ${payload.slice(2)}` };

	return { type: 'plain', text: decodeTransactionMessage(payload) };
};
