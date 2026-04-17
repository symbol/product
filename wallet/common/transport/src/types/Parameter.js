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
 * @typedef {Object} TypeHandler
 * @property {function(string, string): *} parse - Parses raw string value into typed value
 * @property {function(*): boolean} validate - Validates that a value matches the expected type
 */

export {};
