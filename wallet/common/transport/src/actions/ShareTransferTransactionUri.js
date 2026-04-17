import { ActionType, PROTOCOL_VERSION } from '../constants';
import { ParameterConfig } from '../schema';
import { createTransportUri, parseRawParameters, validateParameters } from '../utils';

/**
 * @typedef {Object} Parameters
 * @property {string} chainId - Blockchain chain ID (generation hash)
 * @property {string} networkId - Network identifier ('mainnet' or 'testnet')
 * @property {string} recipientAddress - Recipient account address (Base32 encoded)
 * @property {string} amount - Token amount in atomic units (as numeric String)
 * @property {string} [message] - Optional transaction message content
 * @property {boolean} [isMessageEncrypted] - Optional flag indicating if message is encrypted
 */

const schema = {
	params: {
		required: [
			ParameterConfig.ChainId,
			ParameterConfig.NetworkId,
			ParameterConfig.RecipientAddress,
			ParameterConfig.TokenAbsoluteAmount
		],
		optional: [
			ParameterConfig.Message,
			ParameterConfig.IsMessageEncrypted
		]
	}
};


/**
 * Represents a Share Transfer Transaction URI action.
 * Used to share a pre-filled transfer transaction with recipient, amount, and optional message.
 */
export class ShareTransferTransactionUri {
	static version = PROTOCOL_VERSION;
	static actionType = ActionType.SHARE;
	static method = 'transferTransaction';
    
	#parameters;

	/**
     * Creates a new ShareTransferTransactionUri instance.
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
     * @returns {ShareTransferTransactionUri} New instance with parsed parameters
     * @throws {ValidationError} If parsing or validation fails
     */
	static fromRawParams(rawParameters) {
		const parsedParameters = parseRawParameters(schema, rawParameters);
		return new ShareTransferTransactionUri(parsedParameters);
	}

	/**
     * Creates an instance from a JSON object.
     * 
     * @param {Object} json - JSON object with parameters property
     * @param {Parameters} json.parameters - The parameters to restore
     * @returns {ShareTransferTransactionUri} New instance with restored parameters
     * @throws {ValidationError} If parameters fail validation
     */
	static fromJSON(json) {
		return new ShareTransferTransactionUri(json.parameters);
	}
    
	/**
     * Converts the instance to a JSON-serializable object.
     * 
     * @returns {Object} JSON representation with action metadata and parameters
     */
	toJSON() {
		return { 
			actionType: ShareTransferTransactionUri.actionType,
			method: ShareTransferTransactionUri.method,
			version: ShareTransferTransactionUri.version,
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
			ShareTransferTransactionUri.actionType, 
			ShareTransferTransactionUri.method, 
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
     * Gets the recipient address (Base32 encoded).
     * 
     * @returns {string} The recipient address
     */
	get recipientAddress() {
		return this.#parameters.recipientAddress;
	}

	/**
     * Gets the token amount in atomic units.
     * 
     * @returns {string} The amount as numeric string
     */
	get amount() {
		return this.#parameters.amount;
	}

	/**
     * Gets the optional message content.
     * 
     * @returns {string|undefined} The message, or undefined if not provided
     */
	get message() {
		return this.#parameters.message;
	}

	/**
     * Gets whether the message is encrypted.
     * 
     * @returns {boolean|undefined} True if encrypted, false if not, undefined if not provided
     */
	get isMessageEncrypted() {
		return this.#parameters.isMessageEncrypted;
	}
}
