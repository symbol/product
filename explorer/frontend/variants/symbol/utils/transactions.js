import { SYMBOL_MESSAGE_TYPE, SYMBOL_TRANSACTION_GROUP } from '../constants';
import { MESSAGE_TYPE } from '@/app/constants';
import { decodeTransactionMessage } from '@/app/utils/common';

/**
 * Formats a Symbol transfer message for display.
 * @param {number|null} messageType - Symbol message type.
 * @param {string} payload - message payload without its type prefix.
 * @returns {{ type: string, text: string }|null} formatted message.
 */
export const formatTransferMessage = (messageType, payload) => {
	if (!payload)
		return null;

	if (messageType === SYMBOL_MESSAGE_TYPE.PLAIN)
		return { type: MESSAGE_TYPE.PLAIN, text: decodeTransactionMessage(payload) };

	if (messageType === SYMBOL_MESSAGE_TYPE.ENCRYPTED)
		return { type: MESSAGE_TYPE.ENCRYPTED, text: payload };

	return { type: MESSAGE_TYPE.RAW, text: `HEX: ${payload}` };
};

/**
 * Checks whether a transaction is waiting for cosignatures before it can confirm. A Symbol
 * aggregate bonded transaction stays in the partial group until the required cosignatures are
 * collected, then moves to the unconfirmed group.
 * @param {{ type: string, group: string }} transaction - the transaction to evaluate.
 * @returns {boolean} true when the transaction is awaiting cosignatures.
 */
export const isTransactionAwaitingSignatures = transaction => transaction.group === SYMBOL_TRANSACTION_GROUP.PARTIAL;
