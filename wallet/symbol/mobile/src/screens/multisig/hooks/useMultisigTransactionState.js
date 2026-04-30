import { useCallback, useEffect, useState } from 'react';

/** @typedef {import('@/app/screens/multisig/types/Multisig').Cosignatory} Cosignatory */

/**
 * Return type for useMultisigTransactionState hook.
 * @typedef {object} UseMultisigTransactionStateReturnType
 * @property {number} minApproval - Minimum approvals required for transactions.
 * @property {number} minRemoval - Minimum approvals required for cosignatory removal.
 * @property {Cosignatory[]} cosignatories - List of cosignatory addresses.
 * @property {(value: number) => void} changeMinApproval - Updates minimum approvals value.
 * @property {(value: number) => void} changeMinRemoval - Updates minimum removals value.
 * @property {(cosignatory: Cosignatory) => void} addCosignatory - Adds a cosignatory to the list.
 * @property {(cosignatory: Cosignatory) => void} removeCosignatory - Removes a cosignatory by address.
 * @property {() => void} reset - Resets all state to initial values.
 */

/**
 * React hook for managing the multisig transaction state.
 * Handles cosignatory management and approval thresholds.
 * @param {object} [initialValues] - Initial state values.
 * @param {Cosignatory[]} [initialValues.cosignatories] - Initial cosignatory addresses.
 * @param {number} [initialValues.minApproval] - Initial minimum approvals required for transactions.
 * @param {number} [initialValues.minRemoval] - Initial minimum approvals required for cosignatory removal.
 * @returns {UseMultisigTransactionStateReturnType}
 */
export const useMultisigTransactionState = initialValues => {
	const defaultCosignatories = initialValues?.cosignatories;
	const defaultMinApproval = initialValues?.minApproval ?? 1;
	const defaultMinRemoval = initialValues?.minRemoval ?? 1;

	const [minApproval, setMinApprovals] = useState(defaultMinApproval);
	const [minRemoval, setMinRemovals] = useState(defaultMinRemoval);
	const [cosignatories, setCosignatories] = useState(defaultCosignatories || []);

	const addCosignatory = useCallback(address => {
		setCosignatories(prev => {
			const isDuplicate = prev.some(c => c === address);
            
			if (isDuplicate)
				return prev;

			return [...prev, address];
		});
	}, []);

	const removeCosignatory = useCallback(address => {
		setCosignatories(cosignatories => {
			const updatedCosignatories = cosignatories.filter(c => c !== address);
			const maxApprovals = Math.max(updatedCosignatories.length, 1);
			
			setMinApprovals(prev => Math.min(prev, maxApprovals));
			setMinRemovals(prev => Math.min(prev, maxApprovals));

			return updatedCosignatories;
		});
	}, []);

	const reset = useCallback(() => {
		setMinApprovals(defaultMinApproval);
		setMinRemovals(defaultMinRemoval);

		if (defaultCosignatories?.length > 0)
			setCosignatories(defaultCosignatories);
		else
			setCosignatories([]);
	}, [defaultCosignatories, defaultMinApproval, defaultMinRemoval]);

	useEffect(() => {
		setCosignatories(defaultCosignatories || []);
		setMinApprovals(defaultMinApproval);
		setMinRemovals(defaultMinRemoval);
	}, [defaultCosignatories, defaultMinApproval, defaultMinRemoval]);

	return {
		minApproval,
		minRemoval,
		cosignatories,
		changeMinApproval: setMinApprovals,
		changeMinRemoval: setMinRemovals,
		addCosignatory,
		removeCosignatory,
		reset
	};
};
