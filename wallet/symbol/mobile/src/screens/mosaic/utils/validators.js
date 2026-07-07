import { getSmallestFractionText } from './mosaic-supply';
import { formatNumberGroups } from './number-format';
import {
	MOSAIC_DIVISIBILITY_MIN,
	MOSAIC_DURATION_MAX,
	MOSAIC_DURATION_MIN,
	MOSAIC_MAX_ATOMIC_UNITS,
	MOSAIC_MIN_ATOMIC_UNITS
} from '@/app/screens/mosaic/constants';
import { absoluteToRelativeAmount, relativeToAbsoluteAmount } from 'wallet-common-core';

/**
 * A validation failure result: a localization message key with optional interpolation values.
 * @typedef {object} ValidationError
 * @property {string} key - The localization message key.
 * @property {object} [params] - The values interpolated into the localized message.
 */

/**
 * Counts the fractional digits of a numeric input value (the digits after the decimal separator).
 * @param {string} value - The numeric input value.
 * @returns {number} The number of fractional digits.
 */
const countFractionalDigits = value => {
	const fractionalPart = String(value).split('.')[1];

	return fractionalPart ? fractionalPart.length : 0;
};

/**
 * Validates the mosaic initial supply. The supply is entered in relative units, so its limits depend on the
 * divisibility: the amount is scaled by 10^divisibility to atomic units and must land within the network
 * range of one atomic unit to MOSAIC_MAX_ATOMIC_UNITS. It may not carry more fractional digits than the
 * divisibility, otherwise it would be silently truncated when scaled.
 * @param {string|number} divisibility - The selected mosaic divisibility.
 * @returns {function(string): (ValidationError|undefined)} The validator function.
 */
export const validateMosaicSupply = divisibility => supply => {
	const divisibilityValue = Number(divisibility);

	// The fractional-digit check must run before relativeToAbsoluteAmount, which silently truncates
	// the extra fractional digits and would make this error unreachable.
	if (countFractionalDigits(supply) > divisibilityValue)
	{return divisibilityValue === MOSAIC_DIVISIBILITY_MIN
		? { key: 'validation_error_mosaic_supply_whole' }
		: { key: 'validation_error_mosaic_supply_decimals', params: { divisibility: divisibilityValue } };}

	const absoluteSupply = BigInt(relativeToAbsoluteAmount(supply, divisibilityValue));

	if (absoluteSupply < BigInt(MOSAIC_MIN_ATOMIC_UNITS))
		return { key: 'validation_error_mosaic_supply_low', params: { min: getSmallestFractionText(divisibilityValue) } };

	if (absoluteSupply > BigInt(MOSAIC_MAX_ATOMIC_UNITS)) {
		const maxSupply = formatNumberGroups(absoluteToRelativeAmount(MOSAIC_MAX_ATOMIC_UNITS, divisibilityValue));

		return { key: 'validation_error_mosaic_supply_high', params: { max: maxSupply } };
	}
};

/**
 * Validates the mosaic duration in blocks. Only runs for expiring mosaics; the value must be a whole number
 * of blocks between MOSAIC_DURATION_MIN and MOSAIC_DURATION_MAX (the network 10 year limit).
 * @returns {function(string): (ValidationError|undefined)} The validator function.
 */
export const validateMosaicDuration = () => duration => {
	const blocks = Number(duration);

	if (!Number.isInteger(blocks) || blocks < MOSAIC_DURATION_MIN)
		return { key: 'validation_error_mosaic_duration_low', params: { min: MOSAIC_DURATION_MIN } };

	if (blocks > MOSAIC_DURATION_MAX)
		return { key: 'validation_error_mosaic_duration_high', params: { max: formatNumberGroups(MOSAIC_DURATION_MAX) } };
};
