import { decodeTransactionMessage } from '@/app/utils/common';

const NEM_PLAIN_MESSAGE_TYPE = 1;

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
