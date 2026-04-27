import { getActionClass } from './TransportActionRegistry';
import { ParseError, UnsupportedActionError } from './errors';
import { PROTOCOL_VERSION, URI_SCHEME } from './protocol/constants';
import { extractUrlParts } from './utils';


/**
 * Main entry point for parsing transport URI strings into action instances.
 * 
 * URI format: web+symbol://{version}/{actionType}/{method}?{params}
 * 
 * @example
 * const action = TransportUri.createFromString(
 *   'web+symbol://v1/share/accountAddress?chainId=abc&networkIdentifier=mainnet&address=xyz'
 * );
 */
export class TransportUri {
	/**
     * Parses a URI string and returns the corresponding action instance.
     * 
     * @param {string} uri - The transport URI string to parse
     * @returns {Object} An instance of the appropriate action class
     * @throws {ParseError} If the URI format is invalid or version is unsupported
     * @throws {UnsupportedActionError} If the action type/method is not registered
     * @throws {ValidationError} If parameter validation fails
     */
	static createFromString(uri) {
		const { protocol, pathSegments, queryParameters } = extractUrlParts(uri);
		const [version, actionType, method] = pathSegments;
        
		const isInvalidScheme = protocol !== URI_SCHEME;
        
		if (isInvalidScheme)
		{throw new ParseError(
			`Invalid URI scheme: expected "${URI_SCHEME}", got "${protocol}"`,
			uri
		);}

		const isUnsupportedVersion = version !== PROTOCOL_VERSION;
        
		if (isUnsupportedVersion)
		{throw new ParseError(
			`Unsupported protocol version: expected "${PROTOCOL_VERSION}", got "${version}"`,
			uri
		);}

		const isMissingPathSegments = !actionType || !method;
        
		if (isMissingPathSegments)
		{throw new ParseError(
			'Invalid URI structure: missing action type or method',
			uri
		);}

		const ActionClass = getActionClass(actionType, method);
		const isActionNotFound = !ActionClass;

		if (isActionNotFound)
			throw new UnsupportedActionError(actionType, method);

		return ActionClass.fromRawParams(queryParameters);
	}

	/**
     * Returns the current protocol version.
     * 
     * @returns {string} The protocol version (e.g., 'v1')
     */
	static getProtocolVersion() {
		return PROTOCOL_VERSION;
	}

	/**
     * Returns the URI scheme.
     * 
     * @returns {string} The URI scheme (e.g., 'web+symbol')
     */
	static getScheme() {
		return URI_SCHEME;
	}
}
