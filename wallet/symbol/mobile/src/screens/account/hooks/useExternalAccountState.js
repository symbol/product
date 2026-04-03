import { useValidation } from '@/app/hooks';
import { $t } from '@/app/localization';
import { validateAccountName, validatePrivateKey, validateRequired } from '@/app/utils';
import { useState } from 'react';

/**
 * Return type for useExternalAccountState hook.
 * @typedef {Object} UseExternalAccountStateReturnType
 * @property {boolean} isDialogVisible - Whether the external account dialog is visible.
 * @property {() => void} showDialog - Opens the dialog and resets the account name to the initial value.
 * @property {() => void} hideDialog - Closes the dialog and resets the form values.
 * @property {string} accountNameInput - The raw account name input value.
 * @property {string} accountName - The trimmed account name value.
 * @property {(value: string) => void} setAccountName - Updates the account name input value.
 * @property {string} privateKeyInput - The raw private key input value.
 * @property {string} privateKey - The trimmed private key value.
 * @property {(value: string) => void} setPrivateKey - Updates the private key input value.
 * @property {string|null} nameErrorMessage - Validation error message for the account name.
 * @property {string|null} privateKeyErrorMessage - Validation error message for the private key.
 * @property {boolean} isFormError - Whether any form validation error is currently present.
 */

/**
 * React hook for managing external account form state in a dialog.
 * Handles field values, validation messages, and reset behavior for the account name and private key inputs.
 *
 * @param {Object} params - Hook parameters.
 * @param {string} params.initialName - Initial account name used when the dialog opens or resets.
 * @param {string} params.chainName - Blockchain name used to validate the private key.
 * @returns {UseExternalAccountStateReturnType}
 */
export const useExternalAccountState = ({ initialName, chainName }) => {
	// Dialog
	const [isDialogVisible, setDialogVisible] = useState(false);
	const showDialog = () => {
		setDialogVisible(true);
		setAccountName(initialName);
	};
	const hideDialog = () => {
		setDialogVisible(false);
		setAccountName(initialName);
		setPrivateKey('');
	};

	// Name
	const [accountNameInput, setAccountName] = useState(initialName);
	const nameErrorMessage = useValidation(accountNameInput, [validateRequired(), validateAccountName()], $t);
	const accountName = accountNameInput.trim();

	// Private key
	const [privateKeyInput, setPrivateKey] = useState('');
	const privateKeyErrorMessage = useValidation(privateKeyInput, [validateRequired(), validatePrivateKey(chainName)], $t);
	const privateKey = privateKeyInput.trim();

	return {
		isDialogVisible,
		showDialog,
		hideDialog,
		accountNameInput,
		accountName,
		setAccountName,
		privateKeyInput,
		privateKey,
		setPrivateKey,
		nameErrorMessage,
		privateKeyErrorMessage,
		isFormError: !!nameErrorMessage || !!privateKeyErrorMessage
	};
};
