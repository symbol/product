import { ActionMethod, ActionType, PROTOCOL_VERSION } from '../protocol/constants';
import { ParameterConfig } from '../schema';
import { createTransportUri, parseRawParameters, validateParameters } from '../utils';

/**
 * @typedef {Object} Parameters
 * @property {string} chainName - Blockchain name (e.g., 'symbol', 'nem', 'ethereum')
 * @property {string} networkId - Network identifier ('mainnet' or 'testnet')
 * @property {string} address - Account address (Base32 encoded)
 * @property {string} [name] - Optional human-readable account name
 * @property {string} [chainId] - Blockchain chain ID (generation hash)
 */

const schema = {
	params: {
		required: [
			ParameterConfig.ChainName,
			ParameterConfig.NetworkId,
			ParameterConfig.AccountAddress
		],
		optional: [
			ParameterConfig.AccountName,
			ParameterConfig.ChainId,
		]
	}
};


/**
 * Represents a Share Account Address URI action.
 * Used to share an account address with optional name.
 */
export class ShareAccountAddressUri {
	static version = PROTOCOL_VERSION;
	static actionType = ActionType.SHARE;
	static method = ActionMethod.ACCOUNT_ADDRESS;
    
	#parameters;

	/**
     * Creates a new ShareAccountAddressUri instance.
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
     * @returns {ShareAccountAddressUri} New instance with parsed parameters
     * @throws {ValidationError} If parsing or validation fails
     */
	static fromRawParams(rawParameters) {
		const parsedParameters = parseRawParameters(schema, rawParameters);
		return new ShareAccountAddressUri(parsedParameters);
	}

	/**
     * Creates an instance from a JSON object.
     * 
     * @param {Object} json - JSON object with parameters property
     * @param {Parameters} json.parameters - The parameters to restore
     * @returns {ShareAccountAddressUri} New instance with restored parameters
     * @throws {ValidationError} If parameters fail validation
     */
	static fromJSON(json) {
		return new ShareAccountAddressUri(json.parameters);
	}
    
	/**
     * Converts the instance to a JSON-serializable object.
     * 
     * @returns {Object} JSON representation with action metadata and parameters
     */
	toJSON() {
		return { 
			actionType: ShareAccountAddressUri.actionType,
			method: ShareAccountAddressUri.method,
			version: ShareAccountAddressUri.version,
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
			ShareAccountAddressUri.actionType, 
			ShareAccountAddressUri.method, 
			this.#parameters
		);
	}

	// Getters for parameters

	/**
     * Gets the chain name (e.g., 'symbol', 'nem', 'ethereum').
     * 
     * @returns {string} The chain name
     */
	get chainName() {
		return this.#parameters.chainName;
	}

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
	get networkIdentifier() {
		return this.#parameters.networkIdentifier;
	}

	/**
     * Gets the account address (Base32 encoded).
     * 
     * @returns {string} The account address
     */
	get address() {
		return this.#parameters.address;
	}

	/**
     * Gets the optional account name.
     * 
     * @returns {string|undefined} The account name, or undefined if not provided
     */
	get name() {
		return this.#parameters.name;
	}
}
