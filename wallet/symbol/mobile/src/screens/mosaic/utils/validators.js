import { calculateSupplyDelta, getSmallestFractionText } from './mosaic-supply';
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
 * A validation failure: a localization message key with optional interpolation values.
 * @typedef {object} ValidationError
 * @property {string} key - The localization message key.
 * @property {object} [params] - The values interpolated into the localized message.
 */

/**
 * Counts the digits after the decimal separator of a numeric value (e.g. "1.23" has 2).
 * @param {string} value - The numeric value.
 * @returns {number} The number of fractional digits.
 */
const countFractionalDigits = value => {
	const fractionalPart = String(value).split('.')[1];

	return fractionalPart ? fractionalPart.length : 0;
};

/**
 * Creates a validator for the initial supply at a given divisibility. The supply may not carry more
 * decimal places than the divisibility, and once scaled to atomic units must fall within the allowed range.
 * @param {string|number} divisibility - The mosaic divisibility.
 * @returns {(supply: string) => ValidationError|undefined} The supply validator.
 */
export const validateMosaicSupply = divisibility => supply => {
	const divisibilityValue = Number(divisibility);

	if (countFractionalDigits(supply) > divisibilityValue) {
		return divisibilityValue === MOSAIC_DIVISIBILITY_MIN
			? { key: 'validation_error_mosaic_supply_whole' }
			: { key: 'validation_error_mosaic_supply_decimals', params: { divisibility: divisibilityValue } };
	}

	const absoluteSupply = BigInt(relativeToAbsoluteAmount(supply, divisibilityValue));

	if (absoluteSupply < BigInt(MOSAIC_MIN_ATOMIC_UNITS))
		return { key: 'validation_error_mosaic_supply_low', params: { min: getSmallestFractionText(divisibilityValue) } };

	if (absoluteSupply > BigInt(MOSAIC_MAX_ATOMIC_UNITS)) {
		const maxSupply = formatNumberGroups(absoluteToRelativeAmount(MOSAIC_MAX_ATOMIC_UNITS, divisibilityValue));

		return { key: 'validation_error_mosaic_supply_high', params: { max: maxSupply } };
	}
};

/**
 * Creates a validator rejecting a requested supply equal to the current one, since a supply change
 * transaction with a zero delta would be announced and pay a fee without altering anything.
 * @param {string} currentSupply - The current total supply in relative units.
 * @param {number} divisibility - The mosaic divisibility.
 * @returns {(newSupply: string) => string|undefined} The supply change validator.
 */
export const validateSupplyChanged = (currentSupply, divisibility) => newSupply => {
	const { delta } = calculateSupplyDelta(currentSupply, newSupply, divisibility);

	if (delta === '0')
		return 'validation_error_mosaic_supply_unchanged';
};

/**
 * Creates a validator rejecting the sender's own address as the revocation source, since a mosaic
 * cannot be revoked from the account announcing the revocation.
 * @param {string} senderAddress - The address the revocation is sent from.
 * @returns {(address: string) => string|undefined} The source address validator.
 */
export const validateNotSenderAddress = senderAddress => address => {
	if (address.trim() === senderAddress)
		return 'validation_error_mosaic_revoke_sender';
};

/**
 * Creates a validator for the duration in blocks, applied only to expiring mosaics. The value must be a
 * whole number of blocks within the allowed range.
 * @returns {(duration: string) => ValidationError|undefined} The duration validator.
 */
export const validateMosaicDuration = () => duration => {
	const blocks = Number(duration);

	if (!Number.isInteger(blocks) || blocks < MOSAIC_DURATION_MIN)
		return { key: 'validation_error_mosaic_duration_low', params: { min: MOSAIC_DURATION_MIN } };

	if (blocks > MOSAIC_DURATION_MAX)
		return { key: 'validation_error_mosaic_duration_high', params: { max: formatNumberGroups(MOSAIC_DURATION_MAX) } };
};
