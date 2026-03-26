import { useCallback, useState } from 'react';

/**
 * Return type for useCosignatureInput hook.
 * @typedef {Object} UseCosignatureInputReturnType
 * @property {string} cosignatoryInput - Current input value.
 * @property {(value: string) => void} inputCosignatory - Updates the input value.
 * @property {boolean} isInputDialogVisible - Whether the input dialog is visible.
 * @property {() => void} openInputDialog - Opens the input dialog.
 * @property {() => void} closeInputDialog - Closes the input dialog.
 * @property {() => Promise<void>} submitInput - Submits the current input for validation and resolution.
 */

/**
 * React hook for managing cosignatory input dialog and address/public key resolution.
 * Handles both address and public key input, resolving the public key if an address is provided.
 *
 * @param {(publicKey: string) => void} onNewCosignerSubmit - Callback when a valid cosigner is submitted.
 * @returns {UseCosignatureInputReturnType}
 */
export const useCosignatureInput = onNewCosignerSubmit => {
	const [cosignatoryInput, setCosignatoryInput] = useState('');
	const [isInputDialogVisible, setIsInputDialogVisible] = useState(false);

	const openInputDialog = useCallback(() => {
		setIsInputDialogVisible(true);
		setCosignatoryInput('');
	}, []);

	const closeInputDialog = useCallback(() => {
		setIsInputDialogVisible(false);
		setCosignatoryInput('');
	}, []);

	const submitInput = useCallback(async () => {
		const address = cosignatoryInput.trim();
		onNewCosignerSubmit(address);
		closeInputDialog();
	}, [cosignatoryInput, onNewCosignerSubmit]);

	return {
		cosignatoryInput,
		inputCosignatory: setCosignatoryInput,
		isInputDialogVisible,
		openInputDialog,
		closeInputDialog,
		submitInput
	};
};
