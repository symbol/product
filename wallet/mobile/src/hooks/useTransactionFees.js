import { useMemo } from 'react';
import { calculateTransactionFees } from '@/app/utils';
import * as NetworkTypes from '@/app/types/Network';

/**
 * A custom hook that calculates transaction fees based on network properties.
 *
 * @param {object} transaction - The transaction object for which fees are calculated.
 * @param {NetworkTypes.NetworkProperties} networkProperties - The network properties containing fee multipliers and identifiers.
 * @returns {{ fast: number, medium: number, slow: number }} - An object containing fee estimates for different transaction speeds.
 */
export const useTransactionFees = (transaction, networkProperties) => {
    const defaultTransactionFees = {
        fast: 0,
        medium: 0,
        slow: 0,
    };
    const memoDeps = [
        networkProperties.transactionFees.minFeeMultiplier,
        networkProperties.transactionFees.averageFeeMultiplier,
        transaction,
    ];

    return useMemo(
        () => (networkProperties.networkIdentifier ? calculateTransactionFees(transaction, networkProperties) : defaultTransactionFees),
        memoDeps
    );
};
