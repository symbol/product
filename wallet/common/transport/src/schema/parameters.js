import { ParameterType } from './handlers';

/**
 * @typedef {Object} ParameterDefinition
 * @property {string} name - Parameter name as it appears in the URI query string
 * @property {string} type - Type identifier from ParameterType constants
 * @property {string} [description] - Human-readable description for error messages
 */

/**
 * @typedef {Object} ParameterSchema
 * @property {Object} params - Parameters configuration
 * @property {ParameterDefinition[]} params.required - Required parameters
 * @property {ParameterDefinition[]} params.optional - Optional parameters
 */

/**
 * Pre-defined parameter configurations for common Transport URI parameters.
 * Use these when defining action schemas to ensure consistency.
 * 
 * @type {Object<string, ParameterDefinition>}
 */
export const ParameterConfig = {
	CallbackUrl: {
		name: 'callbackUrl',
		type: ParameterType.URL,
		description: 'URL to receive the response callback'
	},
	ChainName: {
		name: 'chainName',
		type: ParameterType.STRING,
		description: 'Name of the blockchain network (e.g., symbol, nem, ethereum)'
	},
	ChainId: {
		name: 'chainId',
		type: ParameterType.STRING,
		description: 'Unique identifier for the blockchain (generation hash)'
	},
	NetworkIdentifier: {
		name: 'networkIdentifier',
		type: ParameterType.STRING,
		description: 'Network identifier (mainnet, testnet)'
	},
	AccountAddress: {
		name: 'address',
		type: ParameterType.STRING,
		description: 'Symbol account address (Base32 encoded)'
	},
	RecipientAddress: {
		name: 'recipientAddress',
		type: ParameterType.STRING,
		description: 'Recipient account address (Base32 encoded)'
	},
	AccountName: {
		name: 'name',
		type: ParameterType.STRING,
		description: 'Human-readable account name or label'
	},
	TokenAbsoluteAmount: {
		name: 'amount',
		type: ParameterType.UINT64_STRING,
		description: 'Token amount in atomic units (as numeric String)'
	},
	TokenRelativeAmount: {
		name: 'amount',
		type: ParameterType.DECIMAL_STRING,
		description: 'Token amount in relative units (as numeric String)'
	},
	TokenId: {
		name: 'tokenId',
		type: ParameterType.STRING,
		description: 'Mosaic/token identifier (hex String)'
	},
	TransactionPayload: {
		name: 'payload',
		type: ParameterType.STRING,
		description: 'Serialized transaction payload (hex encoded)'
	},
	Message: {
		name: 'message',
		type: ParameterType.STRING,
		description: 'Transaction message content'
	},
	IsMessageEncrypted: {
		name: 'isMessageEncrypted',
		type: ParameterType.BOOLEAN,
		description: 'Whether the message is encrypted'
	}
};
