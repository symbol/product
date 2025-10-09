import { ChainId, NetworkIdentifier } from '../constants';

/**
 * Converts a network type to a network identifier.
 * @param {number} networkType - The network type.
 * @returns {string} The network identifier.
 */
export const chainIdToNetworkIdentifier = chainId => {
	if (chainId === ChainId.MAIN_NET) 
		return NetworkIdentifier.MAIN_NET;

	if (chainId === ChainId.TESTNET) 
		return NetworkIdentifier.TESTNET;

	if (chainId === ChainId.SEPOLIA) 
		return NetworkIdentifier.SEPOLIA;

	throw new Error(`Unsupported chain ID "${chainId}"`);
};

/**
 * Converts a network identifier to a network type.
 * @param {string} networkIdentifier - The network identifier.
 * @returns {number} The network type.
 */
export const networkIdentifierToChainId = networkIdentifier => {
	if (networkIdentifier === NetworkIdentifier.MAIN_NET) 
		return ChainId.MAIN_NET;

	if (networkIdentifier === NetworkIdentifier.TESTNET) 
		return ChainId.TESTNET;

	if (networkIdentifier === NetworkIdentifier.SEPOLIA) 
		return ChainId.SEPOLIA;

	throw new Error(`Unsupported network identifier "${networkIdentifier}"`);
};
