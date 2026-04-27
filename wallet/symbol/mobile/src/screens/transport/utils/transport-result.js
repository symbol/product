import { parseQr } from '@/app/utils';

/** @typedef {import('@/app/lib/transport').ShareAccountAddressUri} ShareAccountAddressUri */
/** @typedef {import('@/app/lib/transport').ShareTransferTransactionUri} ShareTransferTransactionUri */
/** @typedef {import('@/app/lib/transport').RequestSendTransactionUri} RequestSendTransactionUri */
/** @typedef {import('@/app/lib/transport').ParseError} ParseError */
/** @typedef {import('@/app/lib/transport').ValidationError} ValidationError */
/** @typedef {import('@/app/lib/transport').UnsupportedActionError} UnsupportedActionError */

/**
 * @typedef {ShareAccountAddressUri | ShareTransferTransactionUri | RequestSendTransactionUri} TransportUriObject
 */

/**
 * @typedef {Object} ParseStringResult
 * @property {TransportUriObject | null} transportUri - Parsed transport URI action instance, or null if parsing failed
 * @property {ParseError | ValidationError | UnsupportedActionError | null} error - Error thrown during parsing, or null if successful
 */

/**
 * Parses a QR code / transport URI string into a transport URI action instance.
 *
 * @param {string} input - Transport URI string to parse (e.g. from a QR code scan)
 * @returns {ParseStringResult} Result object containing the parsed action instance or the error
 */
export const parseString = input => {
	let transportUri = null;
	let error = null;

	try {
		transportUri = parseQr(input);
	} catch (err) {
		error = err;
	}

	return { transportUri, error };
};
