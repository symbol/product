/**
 * A custom hook that validates a value using an array of validator functions.
 * @param {*} value - The value to be validated.
 * @param {Array<function(any): string | {key: string, params: object} | null>} validators - An array of validator functions.
 *		Each validator should return an error message key, or a key with message parameters,
 *		or `null` if validation passes.
 * @param {function(string, object=): string} [formatResult] - Optional function to format the validation result,
 *		such as a translation function accepting a key and parameters.
 * @returns {string | any | undefined} - The validation error message, or `undefined` if no errors.
 */
export const useValidation = (value, validators, formatResult) => {
	for (const validator of validators) {
		const validationResult = validator(value);

		if (!validationResult)
			continue;

		const isKeyWithParams = typeof validationResult === 'object';
		const key = isKeyWithParams ? validationResult.key : validationResult;
		const params = isKeyWithParams ? validationResult.params : undefined;

		return formatResult ? formatResult(key, params) : key;
	}
};
