import { useProp } from '@/app/hooks';
import { DEFAULT_TRANSACTION_SPEED } from '@/app/screens/mosaic/constants';
import { useCallback, useState } from 'react';

/** @typedef {import('@/app/types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */
/** @typedef {import('@/app/screens/mosaic/types/Mosaic').RevokeMosaicRouteParams} RevokeMosaicRouteParams */

const DEFAULT_AMOUNT = '0';

/**
 * Return type for useRevokeMosaicFormState hook.
 * @typedef {object} UseRevokeMosaicFormStateReturnType
 * @property {string} sourceAddress - The holder address to revoke the mosaic from.
 * @property {string} amount - The amount to revoke.
 * @property {TransactionFeeTierLevel} transactionSpeed - The selected transaction speed.
 * @property {boolean} isAmountValid - Whether the amount is valid.
 * @property {(address: string) => void} changeSourceAddress - Updates the source address.
 * @property {(amount: string) => void} changeAmount - Updates the amount.
 * @property {(speed: TransactionFeeTierLevel) => void} changeTransactionSpeed - Updates transaction speed.
 * @property {(isValid: boolean) => void} changeAmountValidity - Updates amount validity state.
 * @property {() => void} reset - Resets all form state to defaults.
 */

/**
 * React hook for managing the revoke mosaic form state.
 * Handles the source address, amount and transaction speed fields.
 * @param {object} params - Hook parameters.
 * @param {RevokeMosaicRouteParams} [params.routeParams] - Route parameters for pre-filled values.
 * @returns {UseRevokeMosaicFormStateReturnType}
 */
export const useRevokeMosaicFormState = ({ routeParams = {} }) => {
	// Form inputs
	const [sourceAddress, setSourceAddress] = useProp(routeParams.sourceAddress, '');
	const [amount, setAmount] = useProp(routeParams.amount, DEFAULT_AMOUNT);
	const [transactionSpeed, setTransactionSpeed] = useState(DEFAULT_TRANSACTION_SPEED);

	// Validation state
	const [isAmountValid, setAmountValid] = useState(false);

	const reset = useCallback(() => {
		setSourceAddress('');
		setAmount(DEFAULT_AMOUNT);
		setTransactionSpeed(DEFAULT_TRANSACTION_SPEED);
		setAmountValid(false);
	}, [setSourceAddress, setAmount]);

	return {
		// State values
		sourceAddress,
		amount,
		transactionSpeed,
		isAmountValid,

		// State setters
		changeSourceAddress: setSourceAddress,
		changeAmount: setAmount,
		changeTransactionSpeed: setTransactionSpeed,
		changeAmountValidity: setAmountValid,
		reset
	};
};
