import { ParameterType } from '../constants';

/**
 * @typedef {Object} TypeHandler
 * @property {function(string, string): *} parse - Parses raw string value into typed value
 * @property {function(*): boolean} validate - Validates that a value matches the expected type
 */

/**
 * Type handlers for parsing and validating parameter values.
 * Each handler provides parse (string -> typed value) and validate (typed value -> boolean) functions.
 * 
 * @type {Object<string, TypeHandler>}
 */
export const ParameterTypeHandlers = {
	[ParameterType.STRING]: {
		parse: value => value,
		validate: value => typeof value === 'string' && value.trim().length > 0
	},
	[ParameterType.NUMBER]: {
		parse: (value, parameterName) => {
			const parsed = Number(value);
            
			if (isNaN(parsed))
				throw new Error(`Parameter "${parameterName}": expected a number, got "${value}"`);
            
			return parsed;
		},
		validate: value => typeof value === 'number' && !isNaN(value)
	},
	[ParameterType.BOOLEAN]: {
		parse: (value, parameterName) => {
			if (value === 'true')
				return true;
            
			if (value === 'false')
				return false;
            
			throw new Error(`Parameter "${parameterName}": expected "true" or "false", got "${value}"`);
		},
		validate: value => typeof value === 'boolean'
	},
	[ParameterType.UINT64_STRING]: {
		parse: value => value,
		validate: value => typeof value === 'string' && /^\d+$/.test(value)
	},
	[ParameterType.DECIMAL_STRING]: {
		parse: value => value,
		validate: value => typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)
	},
	[ParameterType.URL]: {
		parse: value => value,
		validate: value => typeof value === 'string' && /^https?:\/\/.+/.test(value)
	}
};
