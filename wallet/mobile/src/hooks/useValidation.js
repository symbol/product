/**
 * A custom hook that validates a value using an array of validator functions.
 *
 * @param {*} value - The value to be validated.
 * @param {Array<function(any): string | null>} validators - An array of validator functions.
 *        Each validator should return an error message if validation fails, or `null` if it passes.
 * @param {function(string): string} [formatResult] - Optional function to format the validation result.
 * @returns {string | any | undefined} - The validation error message, or `undefined` if no errors.
 */
export const useValidation = (value, validators, formatResult) => {
	for (const validator of validators) {
		const validationResult = validator(value);

		if (validationResult && formatResult) 
			return formatResult(validationResult);
        
		if (validationResult) 
			return validationResult;  
	}
};
