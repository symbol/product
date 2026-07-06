import {
	DEFAULT_MOSAIC_DIVISIBILITY,
	DEFAULT_MOSAIC_DURATION,
	DEFAULT_MOSAIC_FLAGS,
	DEFAULT_MOSAIC_IS_NEVER_EXPIRING,
	DEFAULT_MOSAIC_SUPPLY,
	DEFAULT_TRANSACTION_SPEED
} from '@/app/screens/mosaic/constants';
import { useCallback, useState } from 'react';

/** @typedef {import('@/app/screens/mosaic/types/Mosaic').MosaicFlagName} MosaicFlagName */
/** @typedef {import('@/app/screens/mosaic/types/Mosaic').MosaicFlags} MosaicFlags */
/** @typedef {import('@/app/types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */

/**
 * Keeps only digits in a numeric field input value.
 * @param {string} value - The raw input value.
 * @returns {string} The sanitized value.
 */
const sanitizeIntegerInput = value => value.replace(/[^0-9]/g, '');

/**
 * Keeps digits and a single decimal separator in a relative-amount input value. A comma is normalized to a
 * dot and any extra separators are folded into the fractional part so the value stays parseable.
 * @param {string} value - The raw input value.
 * @returns {string} The sanitized value.
 */
const sanitizeDecimalInput = value => {
	const [integerPart, ...fractionalParts] = value.replace(/,/g, '.').replace(/[^0-9.]/g, '').split('.');

	return fractionalParts.length ? `${integerPart}.${fractionalParts.join('')}` : integerPart;
};

/**
 * Return type for useCreateMosaicFormState hook.
 * @typedef {object} UseCreateMosaicFormStateReturnType
 * @property {string} divisibility - The mosaic divisibility input value.
 * @property {string} supply - The mosaic initial supply input value.
 * @property {string} duration - The mosaic duration input value in blocks.
 * @property {boolean} isNeverExpiring - Whether the mosaic never expires (unlimited duration).
 * @property {MosaicFlags} flags - The mosaic flags values.
 * @property {TransactionFeeTierLevel} transactionSpeed - The selected transaction speed.
 * @property {(divisibility: string) => void} changeDivisibility - Updates the divisibility.
 * @property {(supply: string) => void} changeSupply - Updates the initial supply.
 * @property {(duration: string) => void} changeDuration - Updates the duration.
 * @property {() => void} toggleNeverExpiring - Toggles the never expiring state.
 * @property {(flagName: MosaicFlagName) => void} toggleFlag - Toggles a mosaic flag by name.
 * @property {(speed: TransactionFeeTierLevel) => void} changeTransactionSpeed - Updates transaction speed.
 * @property {() => void} reset - Resets all form state to defaults.
 */

/**
 * React hook for managing the create mosaic form state.
 * Handles the divisibility, supply, duration, mosaic flags and transaction speed fields.
 * The numeric field setters keep only digits in the input values.
 * @returns {UseCreateMosaicFormStateReturnType}
 */
export const useCreateMosaicFormState = () => {
	// Form inputs
	const [divisibility, setDivisibility] = useState(DEFAULT_MOSAIC_DIVISIBILITY);
	const [supply, setSupply] = useState(DEFAULT_MOSAIC_SUPPLY);
	const [duration, setDuration] = useState(DEFAULT_MOSAIC_DURATION);
	const [isNeverExpiring, setNeverExpiring] = useState(DEFAULT_MOSAIC_IS_NEVER_EXPIRING);
	const [flags, setFlags] = useState(DEFAULT_MOSAIC_FLAGS);
	const [transactionSpeed, setTransactionSpeed] = useState(DEFAULT_TRANSACTION_SPEED);

	const changeDivisibility = useCallback(value => setDivisibility(sanitizeIntegerInput(value)), []);
	const changeSupply = useCallback(value => setSupply(sanitizeDecimalInput(value)), []);
	const changeDuration = useCallback(value => setDuration(sanitizeIntegerInput(value)), []);
	const toggleNeverExpiring = useCallback(() => setNeverExpiring(value => !value), []);
	const toggleFlag = useCallback(flagName => {
		setFlags(flags => ({
			...flags,
			[flagName]: !flags[flagName]
		}));
	}, []);

	const reset = useCallback(() => {
		setDivisibility(DEFAULT_MOSAIC_DIVISIBILITY);
		setSupply(DEFAULT_MOSAIC_SUPPLY);
		setDuration(DEFAULT_MOSAIC_DURATION);
		setNeverExpiring(DEFAULT_MOSAIC_IS_NEVER_EXPIRING);
		setFlags(DEFAULT_MOSAIC_FLAGS);
		setTransactionSpeed(DEFAULT_TRANSACTION_SPEED);
	}, []);

	return {
		// State values
		divisibility,
		supply,
		duration,
		isNeverExpiring,
		flags,
		transactionSpeed,

		// State setters
		changeDivisibility,
		changeSupply,
		changeDuration,
		toggleNeverExpiring,
		toggleFlag,
		changeTransactionSpeed: setTransactionSpeed,
		reset
	};
};
