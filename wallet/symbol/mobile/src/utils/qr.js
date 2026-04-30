import { ShareAccountAddressUri, ShareTransferTransactionUri, TransportUri } from '@/app/lib/transport';

/** @typedef {import('@/app/lib/transport').ShareAccountAddressUri} ShareAccountAddressUri */
/** @typedef {import('@/app/lib/transport').ShareTransferTransactionUri} ShareTransferTransactionUri */
/** @typedef {import('@/app/lib/transport').RequestSendTransactionUri} RequestSendTransactionUri */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * Creates a transport URI string encoding an account address for use in a QR code.
 * @param {object} params - The parameters for the account address URI.
 * @param {string} params.address - The account address (Base32 encoded).
 * @param {ChainName} params.chainName - The blockchain name (e.g., 'symbol', 'ethereum').
 * @param {NetworkIdentifier} params.networkIdentifier - The network identifier (e.g., 'mainnet', 'testnet').
 * @returns {string} The transport URI string suitable for encoding in a QR code.
 */
export const createAccountAddressQr = ({ address, chainName, networkIdentifier }) => {
	const accountAddressUri = new ShareAccountAddressUri({ address, chainName, networkIdentifier });

	return accountAddressUri.toTransportString();
};

/**
 * Creates a transport URI string encoding a pre-filled transfer transaction for use in a QR code.
 * @param {object} params - The parameters for the transfer transaction URI.
 * @param {string} params.recipientAddress - The recipient account address (Base32 encoded).
 * @param {ChainName} params.chainName - The blockchain name (e.g., 'symbol', 'ethereum').
 * @param {NetworkIdentifier} params.networkIdentifier - The network identifier (e.g., 'mainnet', 'testnet').
 * @param {string} params.tokenId - The token ID to include in the transaction.
 * @returns {string} The transport URI string suitable for encoding in a QR code.
 */
export const createTransactionQr = ({ recipientAddress, chainName, networkIdentifier, tokenId }) => {
	const transactionUri = new ShareTransferTransactionUri({ recipientAddress, chainName, networkIdentifier, tokenId });

	return transactionUri.toTransportString();
};

/**
 * Parses a transport URI string from a QR code scan into the corresponding action instance.
 * @param {string} qrString - The raw transport URI string scanned from a QR code.
 * @returns {ShareAccountAddressUri | ShareTransferTransactionUri | RequestSendTransactionUri} The parsed action instance.
 * @throws {import('@/app/lib/transport').ParseError} If the URI format is invalid or the protocol version is unsupported.
 * @throws {import('@/app/lib/transport').UnsupportedActionError} If the action type or method is not registered.
 * @throws {import('@/app/lib/transport').ValidationError} If the URI parameters fail validation.
 */
export const parseQr = qrString => {
	return TransportUri.createFromString(qrString);
};
