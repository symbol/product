/**
 * Groups the integer part of a numeric string into thousands with spaces, dropping insignificant
 * leading zeros and falling back to "0" when empty.
 * @param {string} integerPart - The integer digits of a numeric string.
 * @returns {string} The grouped integer digits.
 * @example
 * formatIntegerGroups('0001234567'); // '1 234 567'
 */
export const formatIntegerGroups = integerPart =>
	(integerPart.replace(/^0+(?=\d)/, '') || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/**
 * Groups the integer part of a numeric value into thousands with spaces, keeping any fractional part
 * unchanged. Expects a canonical value: digits with at most one decimal dot.
 * @param {string|number} value - The numeric value to format.
 * @returns {string} The grouped number text.
 * @example
 * formatNumberGroups('1234567.89'); // '1 234 567.89'
 */
export const formatNumberGroups = value => {
	const [integerPart, fractionalPart] = String(value).split('.');
	const groupedInteger = formatIntegerGroups(integerPart);

	if (fractionalPart === undefined)
		return groupedInteger;

	return `${groupedInteger}.${fractionalPart}`;
};

/**
 * Keeps only digits in a numeric field input value.
 * @param {string} value - The raw input value.
 * @returns {string} The sanitized value.
 */
export const sanitizeIntegerInput = value => value.replace(/[^0-9]/g, '');

/**
 * Keeps digits and a single decimal separator in a relative-amount input value. A comma is normalized to a
 * dot and any extra separators are folded into the fractional part so the value stays parseable.
 * @param {string} value - The raw input value.
 * @returns {string} The sanitized value.
 */
export const sanitizeDecimalInput = value => {
	const [integerPart, ...fractionalParts] = value.replace(/,/g, '.').replace(/[^0-9.]/g, '').split('.');

	return fractionalParts.length ? `${integerPart}.${fractionalParts.join('')}` : integerPart;
};
