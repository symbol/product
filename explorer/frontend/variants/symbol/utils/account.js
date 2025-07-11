//import * as AccountTypes from '@/_variants/symbol/types/Account';
import { PublicKey } from 'symbol-sdk';
import { Address, SymbolFacade } from 'symbol-sdk/symbol';

/**
 * Get the account address from a given public key.
 * @param {string} publicKey - The public key.
 * @param {string} networkIdentifier - The network identifier.
 * @returns {string} The account address.
 */
export const addressFromPublicKey = (publicKey, networkIdentifier) => {
	const facade = new SymbolFacade(networkIdentifier);
	const _publicKey = new PublicKey(publicKey);
	const address = facade.network.publicKeyToAddress(_publicKey);

	return address.toString();
};


/**
 * Checks if a given string is a valid private key.
 * @param {string} stringToTest - The string to test.
 * @returns {boolean} A boolean indicating if the string is a valid private key.
 */
export const isPublicOrPrivateKey = stringToTest => {
	return typeof stringToTest === 'string' && stringToTest.length === 64;
};

/**
 * Checks if a given string is a valid Symbol address.
 * @param {string} address - The address to test.
 * @returns {boolean} A boolean indicating if the string is a valid Symbol address.
 */
export const isSymbolAddress = address => {
	if (typeof address !== 'string') 
		return false;
    
	const addressTrimAndUpperCase = address.trim().toUpperCase().replace(/-/g, '');

	if (addressTrimAndUpperCase.length !== 39) 
		return false;
    
	if (addressTrimAndUpperCase.charAt(0) !== 'T' && addressTrimAndUpperCase.charAt(0) !== 'N') 
		return false;

	return true;
};

/**
 * Converts a raw address to a Symbol address.
 * @param {string} rawAddress - The raw address.
 * @returns {string} The Symbol address.
 */
export const addressFromRaw = rawAddress => {
	return new Address(Buffer.from(rawAddress, 'hex')).toString();
};
