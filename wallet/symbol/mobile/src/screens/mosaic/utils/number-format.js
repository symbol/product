/**
 * Formats the integer part of a numeric string for display: falls back to "0" when empty, strips
 * insignificant leading zeros and inserts thousand-group spaces.
 * @param {string} integerPart - The integer portion of the numeric string.
 * @returns {string} The grouped integer digits.
 */
export const formatIntegerGroups = integerPart =>
	(integerPart.replace(/^0+(?=\d)/, '') || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/**
 * Formats a numeric value with thousand-group spaces on the integer part, preserving any fractional
 * part (e.g. "1234567.89" -> "1 234 567.89"). Expects a canonical value (digits with at most one dot),
 * as produced by the sanitized form state or by converting a number to a string.
 * @param {string|number} value - The canonical numeric value.
 * @returns {string} The grouped number text.
 */
export const formatNumberGroups = value => {
	const [integerPart, fractionalPart] = String(value).split('.');
	const groupedInteger = formatIntegerGroups(integerPart);

	if (fractionalPart === undefined)
		return groupedInteger;

	return `${groupedInteger}.${fractionalPart}`;
};
