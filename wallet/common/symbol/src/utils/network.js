import { NetworkIdentifier, NetworkType } from '../constants';

/**
 * Converts a network type to a network identifier.
 * @param {number} networkType - The network type.
 * @returns {string} The network identifier.
 */
export const networkTypeToIdentifier = networkType => {
	if (networkType === NetworkType.MAIN_NET) 
		return NetworkIdentifier.MAIN_NET;

	if (networkType === NetworkType.TEST_NET) 
		return NetworkIdentifier.TEST_NET;

	return 'custom';
};

/**
 * Converts a network identifier to a network type.
 * @param {string} networkIdentifier - The network identifier.
 * @returns {number} The network type.
 */
export const networkIdentifierToNetworkType = networkIdentifier => {
	if (networkIdentifier === NetworkIdentifier.MAIN_NET) 
		return NetworkType.MAIN_NET;

	if (networkIdentifier === NetworkIdentifier.TEST_NET) 
		return NetworkType.TEST_NET;

	return 0;
};


