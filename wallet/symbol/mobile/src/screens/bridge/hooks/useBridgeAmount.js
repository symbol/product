import { formatAmountInput, getAvailableBalance } from '@/app/utils';
import { useState } from 'react';

/** @typedef {import('@/app/screens/bridge/types/Bridge').StepFees} StepFees */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapSide} SwapSide */
/** @typedef {import('@/app/types/Transaction').TransactionFeeTiers} TransactionFeeTiers */
/** @typedef {import('@/app/types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */

const DEFAULT_AMOUNT = '0';

/**
 * Tiers of every loaded step whose fee is paid in the source chain's native currency: the gas the
 * entered amount must leave in the wallet.
 * @param {SwapSide} source - The source swap side.
 * @param {StepFees[]} stepFees - Fee data per step.
 * @param {string} nativeCurrencyId - Native currency id of the source chain.
 * @param {TransactionFeeTierLevel} transactionFeeTierLevel - Selected fee tier level.
 * @returns {TransactionFeeTiers[]} One tier set per transaction of those steps.
 */
const getNativeCurrencyFeeTiers = (source, stepFees, nativeCurrencyId, transactionFeeTierLevel) => stepFees
	.filter(stepFee => stepFee.feeTiers?.length
		&& stepFee.chainName === source.chainName
		&& stepFee.feeTiers[0][transactionFeeTierLevel].token.id === nativeCurrencyId)
	.flatMap(stepFee => stepFee.feeTiers);

/**
 * Calculates the available balance after the gas of the route's steps.
 * @param {SwapSide|null} source - The source swap side.
 * @param {StepFees[]} stepFees - Fee data per step.
 * @param {TransactionFeeTierLevel} transactionFeeTierLevel - Selected fee tier level.
 * @returns {string} The available balance string.
 */
const calculateAvailableBalance = (source, stepFees, transactionFeeTierLevel) => {
	if (!source?.token || source.token.amount === '0')
		return '0';

	const networkCurrency = source.walletController?.networkProperties?.networkCurrency;

	if (!networkCurrency)
		return '0';

	const nativeCurrencyId = networkCurrency.mosaicId ?? networkCurrency.id;
	const feeTiers = getNativeCurrencyFeeTiers(source, stepFees, nativeCurrencyId, transactionFeeTierLevel);

	// No step's fees are known yet
	if (!feeTiers.length)
		return '0';

	return getAvailableBalance(source.token, nativeCurrencyId, feeTiers, transactionFeeTierLevel);
};

/**
 * Return type for useBridgeAmount hook.
 * @typedef {object} UseBridgeAmountReturnType
 * @property {string} amount - Amount input truncated to the source token's decimals.
 * @property {string} amountInput - Raw amount input value.
 * @property {boolean} isAmountValid - Whether the amount is valid.
 * @property {string} availableBalance - Available balance after fees.
 * @property {(value: string) => void} changeAmount - Updates the amount input.
 * @property {(isValid: boolean) => void} changeAmountValidity - Updates amount validity state.
 * @property {() => void} reset - Resets amount to default value.
 */

/**
 * React hook for managing swap amount input, validation, and available balance calculation.
 * @param {object} params - Hook parameters.
 * @param {SwapSide|null} params.source - The source swap side.
 * @param {StepFees[]} params.stepFees - Fee data per step; a step's tiers are null until fetched.
 * @param {TransactionFeeTierLevel} params.transactionFeeTierLevel - Selected fee tier level.
 * @returns {UseBridgeAmountReturnType}
 */
export const useBridgeAmount = ({ source, stepFees, transactionFeeTierLevel }) => {
	const [amountInput, setAmountInput] = useState(DEFAULT_AMOUNT);
	const [isAmountValid, setAmountValidity] = useState(true);

	const amount = source
		? formatAmountInput(amountInput, source.token.divisibility)
		: amountInput;

	const availableBalance = calculateAvailableBalance(source, stepFees, transactionFeeTierLevel);

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
