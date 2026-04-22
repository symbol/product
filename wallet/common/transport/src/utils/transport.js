import { encodeQueryParameters } from './url';
import { PROTOCOL_VERSION, URI_SCHEME } from '../protocol/constants';

/**
 * Creates a transport URI string from action components.
 * 
 * @param {string} actionType - The action type (e.g., 'share', 'request')
 * @param {string} method - The action method (e.g., 'accountAddress')
 * @param {Object<string, string>} parameters - Parameters to encode in the query string
 * @returns {string} Complete transport URI string
 * 
 * @example
 * createTransportUri('share', 'accountAddress', { chainId: 'abc', address: 'xyz' });
 * // Returns: 'web+symbol://v1/share/accountAddress?chainId=abc&address=xyz'
 */
export const createTransportUri = (actionType, method, parameters) => {
	const queryString = encodeQueryParameters(parameters);
    
	return `${URI_SCHEME}://${PROTOCOL_VERSION}/${actionType}/${method}?${queryString}`;
};
