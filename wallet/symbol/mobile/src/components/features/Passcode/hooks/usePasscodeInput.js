import { useState } from 'react';

/**
 * @typedef {Object} PasscodeInput
 * @property {string} value - The current passcode value.
 * @property {function} inputKey - Function to input a key.
 * @property {function} backspace - Function to delete the last key.
 * @property {function} clear - Function to clear the passcode.
 */

/**
 * Hook for managing passcode input state.
 * @param {object} params - Hook parameters.
 * @param {number} params.length - Length of the passcode.
 * @param {function} params.onComplete - Callback when passcode input is complete.
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
