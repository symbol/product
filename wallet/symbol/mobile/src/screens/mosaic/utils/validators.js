import {
	MOSAIC_DIVISIBILITY_MAX,
	MOSAIC_DIVISIBILITY_MIN,
	MOSAIC_DURATION_MAX,
	MOSAIC_DURATION_MIN,
	MOSAIC_SUPPLY_MAX,
	MOSAIC_SUPPLY_MIN
} from '@/app/screens/mosaic/constants';

/**
 * Creates a validator that checks whether a string is an integer within the given range.
 * @param {number} min - The minimum allowed value.
 * @param {number} max - The maximum allowed value.
 * @param {string} errorMessage - The error message key returned when the validation fails.
 * @returns {function(string): string|undefined} The validator function.
 */
const validateIntegerRange = (min, max, errorMessage) => str => {
	const value = Number(str);

	if (!Number.isInteger(value) || value < min || value > max)
		return errorMessage;
};

/**
 * Validates the mosaic divisibility input.
 * @returns {function(string): string|undefined} The validator function.
 */
export const validateMosaicDivisibility = () =>
	validateIntegerRange(MOSAIC_DIVISIBILITY_MIN, MOSAIC_DIVISIBILITY_MAX, 'validation_error_mosaic_divisibility');

/**
 * Validates the mosaic initial supply input.
 * @returns {function(string): string|undefined} The validator function.
 */
export const validateMosaicSupply = () =>
	validateIntegerRange(MOSAIC_SUPPLY_MIN, MOSAIC_SUPPLY_MAX, 'validation_error_mosaic_supply');

/**
 * Validates the mosaic duration input in blocks.
 * @returns {function(string): string|undefined} The validator function.
 */
export const validateMosaicDuration = () =>
	validateIntegerRange(MOSAIC_DURATION_MIN, MOSAIC_DURATION_MAX, 'validation_error_mosaic_duration');
