import { formatIntegerGroups } from './number-format';

/** @typedef {import('@/app/screens/mosaic/types/Mosaic').SupplyDisplayData} SupplyDisplayData */

/**
 * Returns the smallest transferable fraction for a divisibility as a display string (e.g. "0.001", or "1"
 * for an indivisible mosaic).
 * @param {number} divisibility - The mosaic divisibility.
 * @returns {string} The smallest fraction text.
 */
export const getSmallestFractionText = divisibility => {
	if (divisibility === 0)
		return '1';

	return `0.${'0'.repeat(divisibility - 1)}1`;
};

/**
 * Builds the display segments of the supply amount preview: the grouped integer part, the fractional
 * digits the user entered and the remaining zero padding up to the divisibility. The entered fraction
 * is truncated to the divisibility, so the preview always shows the amount that would be minted;
 * validateMosaicSupply separately rejects a supply carrying extra fractional digits.
 * @param {string} supply - The supply form value.
 * @param {number} divisibility - The mosaic divisibility.
 * @returns {SupplyDisplayData} The supply display segments.
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
