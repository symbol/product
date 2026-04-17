import { validateRawStructure } from './validate';
import { ValidationError } from '../errors';
import { ParameterTypeHandlers } from '../schema';

/** @typedef {import('../types/Parameter').ParameterDefinition} ParameterDefinition */
/** @typedef {import('../types/Parameter').ParameterSchema} ParameterSchema */
/** @typedef {import('../types/Parameter').TypeHandler} TypeHandler */

/**
 * Parses raw string parameters from URI query into typed values.
 * 
 * @param {ParameterSchema} schema - Schema defining required and optional parameters
 * @param {Object<string, string>} rawParameters - Raw string key-value pairs from URI query
 * @param {Object<string, TypeHandler>} [extraTypeHandlers={}] - Additional type handlers for custom types
 * @returns {Object} Parsed parameters with correct types
 * @throws {ValidationError} If required parameters are missing or conversion fails
 */
export const parseRawParameters = (schema, rawParameters, extraTypeHandlers = {}) => {
	// Validate structure first - checks for missing required and unknown parameters
	validateRawStructure(schema, rawParameters);

	const { required, optional } = schema.params;
	const parsedParameters = {};
	const errors = [];

	// Parse required parameters
	for (const parameterDefinition of required) {
		const typeHandler = extraTypeHandlers[parameterDefinition.type] || ParameterTypeHandlers[parameterDefinition.type];
        
		if (!typeHandler) {
			errors.push(`Unknown type "${parameterDefinition.type}" for parameter "${parameterDefinition.name}"`);
			continue;
		}

		try {
			parsedParameters[parameterDefinition.name] = typeHandler.parse(
				rawParameters[parameterDefinition.name], 
				parameterDefinition.name
			);
		} catch (error) {
			errors.push(error.message);
		}
	}

	// Parse optional parameters (only if present)
	for (const parameterDefinition of optional) {
		const isParameterProvided = parameterDefinition.name in rawParameters;
        
		if (!isParameterProvided) 
			continue;

		const typeHandler = extraTypeHandlers[parameterDefinition.type] || ParameterTypeHandlers[parameterDefinition.type];
        
		if (!typeHandler) {
			errors.push(`Unknown type "${parameterDefinition.type}" for parameter "${parameterDefinition.name}"`);
			continue;
		}

		try {
			parsedParameters[parameterDefinition.name] = typeHandler.parse(
				rawParameters[parameterDefinition.name], 
				parameterDefinition.name
			);
		} catch (error) {
			errors.push(error.message);
		}
	}

	const hasErrors = errors.length > 0;
    
	if (hasErrors)
		throw new ValidationError('Parameter parsing failed', errors);

	return parsedParameters;
};
