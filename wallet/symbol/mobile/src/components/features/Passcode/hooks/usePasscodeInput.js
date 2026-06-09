import { useState } from 'react';

/**
 * Passcode input state and key-press handlers.
 * @typedef {object} PasscodeInput
 * @property {string} value - The current passcode value.
 * @property {function(string): void} inputKey - Function to input a key.
 * @property {function(): void} backspace - Function to delete the last key.
 * @property {function(): void} clear - Function to clear the passcode.
 */

/**
 * React hook for managing passcode input state.
 * @param {object} params - Hook parameters.
 * @param {number} params.length - Length of the passcode.
 * @param {function(): void} params.onComplete - Callback when passcode input is complete.
 * @returns {PasscodeInput} - Passcode input state and handlers.
 */
export const usePasscodeInput = ({ length, onComplete }) => {
	const [value, setValue] = useState('');

	const inputKey = key => {
		if (value.length >= length) 
			return;

		const newValue = value + key;
		setValue(newValue);

		if (newValue.length === length) 
			onComplete(newValue);
	};

	const backspace = () => 
		setValue(value => value.slice(0, -1));

	const clear = () => 
		setValue('');

	return {
		value,
		inputKey,
		backspace,
		clear
	};
};
