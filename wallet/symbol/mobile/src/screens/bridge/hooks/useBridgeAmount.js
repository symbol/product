import { formatAmountInput, getAvailableBalance } from '@/app/utils';
import { useState } from 'react';

/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapSide} SwapSide */
/** @typedef {import('@/app/types/Transaction').TransactionFeeTiers} TransactionFeeTiers */
/** @typedef {import('@/app/types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */
/** @typedef {import('@/app/types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('@/app/types/Network').NetworkCurrency} NetworkCurrency */

const DEFAULT_AMOUNT = '0';

/**
 * Extracts the native currency info from a swap source side.
 * @param {SwapSide|null} source - The source swap side.
 * @returns {NetworkCurrency|null} The native currency info or null.
 */
const getNativeCurrency = source => {
	const networkCurrency = source?.walletController?.networkProperties?.networkCurrency;

	if (!networkCurrency)
		return null;

	const id = networkCurrency.mosaicId || networkCurrency.id;

	return {
		...networkCurrency,
		id
	};
};

/**
 * Calculates the available balance after accounting for transaction fees.
 * @param {SwapSide|null} source - The source swap side.
 * @param {TransactionFeeTiers|null} transactionFees - Transaction fee tiers.
 * @param {TransactionFeeTierLevel} transactionFeeTierLevel - Selected fee tier level.
 * @returns {string} The available balance string.
 */
const calculateAvailableBalance = (source, transactionFees, transactionFeeTierLevel) => {
	if (!source?.token || source.token.amount === '0' || !transactionFees)
		return '0';

	const networkCurrency = getNativeCurrency(source);

	if (!networkCurrency)
		return '0';

	const nativeCurrencyId = networkCurrency.mosaicId || networkCurrency.id;

	return getAvailableBalance(source.token, nativeCurrencyId, transactionFees, transactionFeeTierLevel);
};

/**
 * Return type for useBridgeAmount hook.
 * @typedef {Object} UseBridgeAmountReturnType
 * @property {string} amount - Formatted amount value.
 * @property {string} amountInput - Raw amount input value.
 * @property {boolean} isAmountValid - Whether the amount is valid.
 * @property {string} availableBalance - Available balance after fees.
 * @property {(value: string) => void} changeAmount - Updates the amount input.
 * @property {(isValid: boolean) => void} changeAmountValidity - Updates amount validity state.
 * @property {() => void} reset - Resets amount to default value.
 */

/**
 * React hook for managing swap amount input, validation, and available balance calculation.
 * @param {Object} params - Hook parameters.
 * @param {SwapSide|null} params.source - The source swap side.
 * @param {TransactionFeeTiers|null} params.transactionFees - Transaction fee tiers.
 * @param {TransactionFeeTierLevel} params.transactionFeeTierLevel - Selected fee tier level.
 * @returns {UseBridgeAmountReturnType}
 */
export const useBridgeAmount = ({ source, transactionFees, transactionFeeTierLevel }) => {
	const [amountInput, setAmountInput] = useState(DEFAULT_AMOUNT);
	const [isAmountValid, setAmountValidity] = useState(true);

	const nativeCurrency = getNativeCurrency(source);
	const amount = nativeCurrency 
		? formatAmountInput(amountInput, nativeCurrency.divisibility) 
		: amountInput;

	const availableBalance = calculateAvailableBalance(source, transactionFees, transactionFeeTierLevel);
    
	const reset = () => setAmountInput(DEFAULT_AMOUNT);

	return {
		amount,
		amountInput,
		isAmountValid,
		availableBalance,
		changeAmount: setAmountInput,
		changeAmountValidity: setAmountValidity,
		reset
	};
};
