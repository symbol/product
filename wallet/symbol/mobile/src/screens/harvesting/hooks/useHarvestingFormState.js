import { DEFAULT_TRANSACTION_SPEED } from '@/app/screens/harvesting/constants';
import { useCallback, useEffect, useState } from 'react';

/** @typedef {import('@/app/types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */

/**
 * Return type for useHarvestingFormState hook.
 * @typedef {Object} UseHarvestingFormStateReturnType
 * @property {string} nodeUrl - Currently selected node URL.
 * @property {TransactionFeeTierLevel} feeLevel - Selected transaction fee level.
 * @property {(value: string) => void} setNodeUrl - Updates node URL.
 * @property {(level: TransactionFeeTierLevel) => void} setFeeLevel - Updates fee level.
 * @property {() => void} reset - Resets form to initial state.
 */

/**
 * React hook for managing harvesting form state.
 *
 * @param {Object} overrideValues - Initial form values.
 * @param {string} [overrideValues.nodeUrl=''] - Node URL to pre-fill in the form.
 * @returns {UseHarvestingFormStateReturnType}
 */
export const useHarvestingFormState = overrideValues => {
	const defaultNodeUrl = overrideValues.nodeUrl ?? '';
	const defaultFeeLevel = DEFAULT_TRANSACTION_SPEED;

	const [nodeUrl, setNodeUrl] = useState(defaultNodeUrl);
	const [feeLevel, setFeeLevel] = useState(defaultFeeLevel);

	const reset = useCallback(() => {
		setNodeUrl(defaultNodeUrl);
		setFeeLevel(defaultFeeLevel);
	}, [defaultNodeUrl, defaultFeeLevel]);

	// Override node URL when changed
	useEffect(() => {
		if (overrideValues.nodeUrl)
			setNodeUrl(overrideValues.nodeUrl);
	}, [overrideValues.nodeUrl]);

	return {
		nodeUrl,
		feeLevel,
		setNodeUrl,
		setFeeLevel,
		reset
	};
};
