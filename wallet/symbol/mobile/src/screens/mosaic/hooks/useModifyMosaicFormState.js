import { useProp } from '@/app/hooks';
import { DEFAULT_TRANSACTION_SPEED } from '@/app/screens/mosaic/constants';
import { sanitizeDecimalInput } from '@/app/screens/mosaic/utils';
import { useCallback, useState } from 'react';

/** @typedef {import('@/app/types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */

const DEFAULT_NEW_SUPPLY = '';

/**
 * Return type for useModifyMosaicFormState hook.
 * @typedef {object} UseModifyMosaicFormStateReturnType
 * @property {string} newSupply - The requested total supply input value.
 * @property {TransactionFeeTierLevel} transactionSpeed - The selected transaction speed.
 * @property {(supply: string) => void} changeNewSupply - Updates the requested total supply.
 * @property {(speed: TransactionFeeTierLevel) => void} changeTransactionSpeed - Updates transaction speed.
 * @property {() => void} reset - Resets all form state to defaults.
 */

/**
 * React hook for managing the modify mosaic form state. Handles the requested total supply and the
 * transaction speed. The supply field is seeded with the mosaic's current supply as soon as it is known,
 * so the form opens on the value the user is editing away from rather than on an empty field.
 * @param {object} params - Hook parameters.
 * @param {string} [params.currentSupply] - The current total supply, once the mosaic is loaded.
 * @returns {UseModifyMosaicFormStateReturnType}
 */
export const useModifyMosaicFormState = ({ currentSupply }) => {
	// Form inputs
	const [newSupply, setNewSupply] = useProp(currentSupply, DEFAULT_NEW_SUPPLY);
	const [transactionSpeed, setTransactionSpeed] = useState(DEFAULT_TRANSACTION_SPEED);

	const changeNewSupply = useCallback(value => setNewSupply(sanitizeDecimalInput(value)), [setNewSupply]);

	const reset = useCallback(() => {
		setNewSupply(DEFAULT_NEW_SUPPLY);
		setTransactionSpeed(DEFAULT_TRANSACTION_SPEED);
	}, [setNewSupply]);

	return {
		// State values
		newSupply,
		transactionSpeed,

		// State setters
		changeNewSupply,
		changeTransactionSpeed: setTransactionSpeed,
		reset
	};
};
