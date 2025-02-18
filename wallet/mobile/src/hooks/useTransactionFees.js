import { useMemo } from 'react';
import { getTransactionFees } from '@/app/utils/transaction';

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
        () => (networkProperties.networkIdentifier ? getTransactionFees(transaction, networkProperties) : defaultTransactionFees),
        memoDeps
    );
};
