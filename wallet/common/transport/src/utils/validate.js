import { ValidationError } from '../errors';
import { ParameterTypeHandlers } from '../schema';

/** @typedef {import('../schema/parameters').ParameterDefinition} ParameterDefinition */
/** @typedef {import('../schema/parameters').ParameterSchema} ParameterSchema */
/** @typedef {import('../schema/handlers').TypeHandler} TypeHandler */

/**
 * Validates that parsed parameters conform to the expected schema and types.
 * This should be called AFTER parsing raw parameters to typed values.
 * 
 * @param {ParameterSchema} schema - Schema defining required and optional parameters
 * @param {Object} parameters - Already-parsed parameters with correct types
 * @param {Object<string, TypeHandler>} [extraTypeHandlers={}] - Additional type handlers for custom types
 * @throws {ValidationError} If validation fails
 */
export const validateParameters = (schema, parameters, extraTypeHandlers = {}) => {
	// Validate structure first - checks for missing required and unknown parameters
	validateRawStructure(schema, parameters);

	const { required, optional } = schema.params;
	const errors = [];

	// Build a map of all allowed parameters for quick lookup
	const allParameterDefinitions = new Map();
	[...required, ...optional].forEach(parameterDefinition => {
		allParameterDefinitions.set(parameterDefinition.name, parameterDefinition);
	});

	// Validate each provided parameter
	const parameterNames = Object.keys(parameters);
    
	for (const name of parameterNames) {
		const parameterDefinition = allParameterDefinitions.get(name);

		// This should not happen since validateRawStructure already checks for unknown parameters
		if (!parameterDefinition) {
			errors.push(`Unexpected parameter: "${name}"`);
			continue;
		}

		const typeHandler = extraTypeHandlers[parameterDefinition.type] || ParameterTypeHandlers[parameterDefinition.type];

		if (!typeHandler) {
			errors.push(`No type handler for type "${parameterDefinition.type}" (parameter: "${name}")`);
			continue;
		}

		const isValid = typeHandler.validate(parameters[name]);
        
		if (!isValid) {
			const description = parameterDefinition.description ? ` (${parameterDefinition.description})` : '';
			errors.push(`Invalid "${name}"${description}: expected type "${parameterDefinition.type}"`);
		}
	}

	const hasErrors = errors.length > 0;
    
	if (hasErrors)
		throw new ValidationError('Parameter validation failed', errors);
};

/**
 * Checks that all required parameters exist and no unknown parameters are present.
 * This is a structural validation - it does not check parameter types.
 * 
 * @param {ParameterSchema} schema - Schema defining required and optional parameters
 * @param {Object<string, *>} parameters - Parameters object to validate
 * @throws {ValidationError} If structural validation fails
 */
export const validateRawStructure = (schema, parameters) => {
	const { required, optional } = schema.params;
	const parameterNames = Object.keys(parameters);
	const errors = [];

	// Check required parameters exist
	const missingRequired = required.filter(parameterDefinition => 
		!parameterNames.includes(parameterDefinition.name));
    
	if (missingRequired.length > 0) {
		missingRequired.forEach(parameterDefinition => {
			errors.push(`Missing required parameter: "${parameterDefinition.name}"`);
		});
	}

	// Check for unknown parameters
	const allowedNames = new Set([...required, ...optional].map(parameterDefinition => parameterDefinition.name));
	const unknownParameters = parameterNames.filter(name => !allowedNames.has(name));
    
	if (unknownParameters.length > 0) {
		unknownParameters.forEach(name => {
			errors.push(`Unknown parameter: "${name}"`);
		});
	}

	const hasErrors = errors.length > 0;
    
	if (hasErrors)
		throw new ValidationError('Invalid parameter structure', errors);
};
