import { getTokenTickerText } from './token-ticker';
import { getTotalFeeAmount } from '@/app/utils';
import { safeOperationWithRelativeAmounts } from 'wallet-common-core';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeEstimation} BridgeEstimation */
/** @typedef {import('@/app/screens/bridge/types/Bridge').FeeGroup} FeeGroup */
/** @typedef {import('@/app/screens/bridge/types/Bridge').StepTransactionFees} StepTransactionFees */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapWorkflowManager} SwapWorkflowManager */
/** @typedef {import('@/app/types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */

const addAmounts = (...amounts) => amounts.reduce((total, amount) => total + amount, 0n);

/**
 * Groups fee entries for display: entries with the same token on the same chain are added into one
 * group, others keep their own group in the original (step) order.
 * @param {object[]} entries - Fee entries with amount, token info and chain name.
 * @returns {FeeGroup[]} Display fee groups.
 */
const createFeeGroups = entries => {
	const groups = [];

	for (const entry of entries) {
		const existingGroup = groups.find(group => group.tokenId === entry.tokenId && group.chainName === entry.chainName);

		if (existingGroup)
			existingGroup.amounts.push(entry.amount);
		else
			groups.push({ ...entry, amounts: [entry.amount] });
	}

	// A single amount is passed through unchanged, so its display matches the source value exactly
	return groups.map(group => ({
		amount: group.amounts.length === 1
			? group.amounts[0]
			: safeOperationWithRelativeAmounts(group.divisibility, group.amounts, addAmounts),
		tokenName: group.tokenName,
		chainName: group.chainName
	}));
};

/**
 * Builds the operation fee groups of a swap from the per-step estimations, so multi-step routes
 * display every step's fee instead of only the last one. Fees in the same token are added; fees in
 * different tokens keep separate groups. Returns no groups while the estimation is missing or failed.
 * @param {BridgeEstimation[]|null} estimations - Per-step bridge estimations.
 * @param {SwapWorkflowManager|null} bridge - The bridge manager instance.
 * @returns {FeeGroup[]} Operation fee groups.
 */
export const createOperationFeeGroups = (estimations, bridge) => {
	if (!estimations?.length || !bridge)
		return [];

	if (estimations.some(estimation => !estimation || estimation.error))
		return [];

	const entries = [];
	estimations.forEach((estimation, stepIndex) => {
		const pair = bridge.getPairForStep(stepIndex);
		const token = pair?.targetTokenInfo;
		const targetWalletController = pair?.targetWalletController;

		if (!estimation.bridgeFee || !token || !targetWalletController)
			return;

		entries.push({
			amount: estimation.bridgeFee,
			tokenId: token.id,
			tokenName: getTokenTickerText(token, targetWalletController.chainName, targetWalletController.networkIdentifier),
			divisibility: token.divisibility,
			chainName: targetWalletController.chainName
		});
	});

	return createFeeGroups(entries);
};

/**
 * Builds the transaction (gas) fee groups of a swap from the per-step fee data, so multi-step routes
 * display the gas of every step instead of only the first one. Fees paid in the same currency on the
 * same chain are added; others keep separate groups. A step whose fee tiers are not loaded yet counts
 * as zero; steps without a network currency are skipped.
 * @param {StepTransactionFees[]} stepFees - Per-step transaction fee data.
 * @param {TransactionFeeTierLevel} tierLevel - The selected fee tier level (e.g. 'medium').
 * @returns {FeeGroup[]} Transaction fee groups.
 */
export const createTransactionFeeGroups = (stepFees, tierLevel) => {
	if (!stepFees?.length)
		return [];

	const entries = stepFees
		.filter(stepFee => stepFee?.networkCurrency)
		.map(stepFee => ({
			amount: stepFee.feeTiers?.length ? getTotalFeeAmount(stepFee.feeTiers, tierLevel) : '0',
			tokenId: stepFee.networkCurrency.id,
			tokenName: getTokenTickerText(stepFee.networkCurrency, stepFee.chainName, stepFee.networkIdentifier),
			divisibility: stepFee.networkCurrency.divisibility,
			chainName: stepFee.chainName
		}));

	return createFeeGroups(entries);
};
