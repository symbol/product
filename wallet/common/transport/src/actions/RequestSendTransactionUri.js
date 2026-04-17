import { ActionType, PROTOCOL_VERSION } from '../constants';
import { ParameterConfig } from '../schema';
import { createTransportUri, parseRawParameters, validateParameters } from '../utils';

/**
 * @typedef {Object} Parameters
 * @property {string} chainId - Blockchain chain ID (generation hash)
 * @property {string} networkId - Network identifier ('mainnet' or 'testnet')
 * @property {string} payload - Serialized transaction payload (hex encoded)
 * @property {string} [callbackUrl] - Optional URL to receive the response callback
 */

const schema = {
	params: {
		required: [
			ParameterConfig.ChainId,
			ParameterConfig.NetworkId,
			ParameterConfig.TransactionPayload
		],
		optional: [
			ParameterConfig.CallbackUrl
		]
	}
};


/**
 * Represents a Request Send Transaction URI action.
 * Used to request the wallet to sign and announce a transaction.
 */
export class RequestSendTransactionUri {
	static version = PROTOCOL_VERSION;
	static actionType = ActionType.REQUEST;
	static method = 'sendTransaction';
    
	#parameters;

	/**
     * Creates a new RequestSendTransactionUri instance.
     * 
     * @param {Parameters} parameters - Validated parameters object
     * @throws {ValidationError} If parameters fail validation
     */
	constructor(parameters) {
		validateParameters(schema, parameters);
		this.#parameters = { ...parameters };
	}

	/**
     * Creates an instance from raw string parameters (e.g., from URL query).
     * 
     * @param {Object<string, string>} rawParameters - Raw string key-value pairs
     * @returns {RequestSendTransactionUri} New instance with parsed parameters
     * @throws {ValidationError} If parsing or validation fails
     */
	static fromRawParams(rawParameters) {
		const parsedParameters = parseRawParameters(schema, rawParameters);
		return new RequestSendTransactionUri(parsedParameters);
	}

	/**
     * Creates an instance from a JSON object.
     * 
     * @param {Object} json - JSON object with parameters property
     * @param {Parameters} json.parameters - The parameters to restore
     * @returns {RequestSendTransactionUri} New instance with restored parameters
     * @throws {ValidationError} If parameters fail validation
     */
	static fromJSON(json) {
		return new RequestSendTransactionUri(json.parameters);
	}
    
	/**
     * Converts the instance to a JSON-serializable object.
     * 
     * @returns {Object} JSON representation with action metadata and parameters
     */
	toJSON() {
		return { 
			actionType: RequestSendTransactionUri.actionType,
			method: RequestSendTransactionUri.method,
			version: RequestSendTransactionUri.version,
			parameters: { ...this.#parameters }
		};
	}

	/**
     * Converts the instance to a transport URI string.
     * 
     * @returns {string} The URI string
     */
	toTransportString() {
		return createTransportUri(
			RequestSendTransactionUri.actionType, 
			RequestSendTransactionUri.method, 
			this.#parameters
		);
	}

	// Getters for parameters

	/**
     * Gets the chain ID (generation hash).
     * 
     * @returns {string} The chain ID
     */
	get chainId() {
		return this.#parameters.chainId;
	}

	/**
     * Gets the network ID ('mainnet' or 'testnet').
     * 
     * @returns {string} The network ID
     */
	get networkId() {
		return this.#parameters.networkId;
	}

	/**
     * Gets the transaction payload (hex encoded).
     * 
     * @returns {string} The transaction payload
     */
	get payload() {
		return this.#parameters.payload;
	}

	/**
     * Gets the optional callback URL.
     * 
     * @returns {string|undefined} The callback URL, or undefined if not provided
     */
	get callbackUrl() {
		return this.#parameters.callbackUrl;
	}
}
