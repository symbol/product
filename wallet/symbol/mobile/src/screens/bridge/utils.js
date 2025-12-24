export const validateEstimation = estimation => () => {
    if (estimation?.error?.isAmountLow)
        return 'validation_error_amount_low';

    if (estimation?.error?.isAmountHigh)
        return 'validation_error_amount_high';
};
