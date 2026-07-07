import { formatIntegerGroups } from './number-format';

/** @typedef {import('@/app/screens/mosaic/types/Mosaic').SupplyDisplayData} SupplyDisplayData */

/**
 * Returns the smallest transferable amount for a divisibility as a display string: "1" when the mosaic
 * is indivisible, otherwise a fraction with a single 1 in the last decimal place.
 * @param {number} divisibility - The mosaic divisibility.
 * @returns {string} The smallest fraction text.
 * @example
 * getSmallestFractionText(3); // '0.001'
 * getSmallestFractionText(0); // '1'
 */
export const getSmallestFractionText = divisibility => {
	if (divisibility === 0)
		return '1';

	return `0.${'0'.repeat(divisibility - 1)}1`;
};

/**
 * Splits a supply value into the display segments of the amount preview: the grouped integer part, the
 * entered fractional digits truncated to the divisibility, and the zero padding filling the remaining
 * decimal capacity. Truncating keeps the preview equal to the amount that would actually be minted.
 * @param {string} supply - The supply form value.
 * @param {number} divisibility - The mosaic divisibility.
 * @returns {SupplyDisplayData} The supply display segments.
 * @example
 * createSupplyDisplayData('1000.5', 3);
 * // { integer: '1 000', enteredFraction: '5', paddingFraction: '00' }
 */
export const createSupplyDisplayData = (supply, divisibility) => {
	const [integerPart, fractionalPart = ''] = supply.split('.');
	const enteredFraction = fractionalPart.slice(0, divisibility);
	const paddingFraction = '0'.repeat(Math.max(divisibility - enteredFraction.length, 0));

	return {
		integer: formatIntegerGroups(integerPart),
		enteredFraction,
		paddingFraction
	};
};
