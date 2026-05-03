import { TransportValidationResult } from '../types/TransportValidation';

/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */

/**
 * Validates a parsed transport URI object against the current wallet state.
 * Checks are applied in priority order: chainName support, chainName active, networkIdentifier, then chainId.
 * @param {import('./transport-actions').TransportUriObject | null} transportUriObject - Parsed transport URI object.
 * @param {object} walletState - Current wallet state.
 * @param {NetworkIdentifier} walletState.networkIdentifier - Current network identifier.
 * @param {object} walletState.networkProperties - Current network properties.
 * @param {string[]} walletState.supportedChains - List of supported chain names.
 * @param {string[]} walletState.activeChains - List of active chain names with selected accounts.
 * @returns {string | null} A {@link TransportValidationResult} value if validation fails, or null if valid.
 */
export const validateTransportObject = (transportUriObject, { networkIdentifier, networkProperties, supportedChains, activeChains }) => {
	if (!transportUriObject)
		return null;

	if (!supportedChains.includes(transportUriObject.chainName))
		return TransportValidationResult.UNSUPPORTED_CHAIN;

	if (!activeChains.includes(transportUriObject.chainName))
		return TransportValidationResult.INACTIVE_CHAIN;

	if (transportUriObject.networkIdentifier !== networkIdentifier)
		return TransportValidationResult.NETWORK_MISMATCH;

	const chainId = networkProperties?.chainId || networkProperties?.generationHash;
	if (chainId && transportUriObject.chainId && transportUriObject.chainId !== chainId)
		return TransportValidationResult.CHAIN_ID_MISMATCH;

	return null;
};
