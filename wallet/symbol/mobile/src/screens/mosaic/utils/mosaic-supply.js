import { formatIntegerGroups } from './number-format';
import { MosaicSupplyChangeAction } from '@/app/constants';
import { absoluteToRelativeAmount, relativeToAbsoluteAmount } from 'wallet-common-core';

/** @typedef {import('@/app/screens/mosaic/types/Mosaic').SupplyDeltaData} SupplyDeltaData */
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

/**
 * Describes the change between the current and the requested total supply. The two amounts are compared in
 * absolute (atomic) units with BigInt so a divisible supply is never subject to floating point drift. An
 * unchanged supply yields a zero delta and no action, which the caller is expected to reject before sending.
 * @param {string} currentSupply - The current total supply in relative units.
 * @param {string} newSupply - The requested total supply in relative units.
 * @param {number} divisibility - The mosaic divisibility.
 * @returns {SupplyDeltaData} The supply change data.
 * @example
 * calculateSupplyDelta('1000', '1500.5', 1); // { delta: '500.5', action: 1 }
 * calculateSupplyDelta('1000', '1000', 0);   // { delta: '0', action: null }
 */
export const calculateSupplyDelta = (currentSupply, newSupply, divisibility) => {
	const currentAbsoluteSupply = BigInt(relativeToAbsoluteAmount(currentSupply, divisibility));
	const newAbsoluteSupply = BigInt(relativeToAbsoluteAmount(newSupply, divisibility));
	const absoluteDelta = newAbsoluteSupply - currentAbsoluteSupply;
	const isIncrease = absoluteDelta > 0n;
	const absoluteMagnitude = isIncrease ? absoluteDelta : -absoluteDelta;
	const changeAction = isIncrease ? MosaicSupplyChangeAction.Increase : MosaicSupplyChangeAction.Decrease;

	return {
		delta: absoluteToRelativeAmount(absoluteMagnitude.toString(), divisibility),
		action: absoluteDelta === 0n ? null : changeAction
	};
};

/**
 * Returns a supply amount padded to the full divisibility, so amounts listed together keep the same number of
 * decimals and stay directly comparable.
 * @param {string} supply - The supply amount in relative units.
 * @param {number} divisibility - The mosaic divisibility.
 * @returns {string} The grouped, decimal-padded amount text.
 * @example
 * getPaddedSupplyText('1000.5', 3); // '1 000.500'
 */
export const getPaddedSupplyText = (supply, divisibility) => {
	const { integer, enteredFraction, paddingFraction } = createSupplyDisplayData(supply, divisibility);

	if (!divisibility)
		return integer;

	return `${integer}.${enteredFraction}${paddingFraction}`;
};

/**
 * Returns the supply delta as signed text padded to the full divisibility, matching the decimals of the supply
 * amounts it is shown beside. A zero delta carries no sign.
 * @param {string} delta - The supply change magnitude in relative units.
 * @param {number|null} action - The supply change action, or null when the supply is unchanged.
 * @param {number} divisibility - The mosaic divisibility.
 * @returns {string} The signed, decimal-padded delta text.
 * @example
 * getPaddedSupplyDeltaText('500.5', 1, 3); // '+500.500'
 */
export const getPaddedSupplyDeltaText = (delta, action, divisibility) => {
	const deltaText = getPaddedSupplyText(delta, divisibility);

	if (delta === '0')
		return deltaText;

	return MosaicSupplyChangeAction.Increase === action ? `+${deltaText}` : `-${deltaText}`;
};
