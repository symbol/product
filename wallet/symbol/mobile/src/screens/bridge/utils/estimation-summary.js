import { formatPriceImpactText, isEstimationComplete } from './estimation';
import { createSwapSideKey } from './swap-selector';
import { $t } from '@/app/localization';
import { PriceImpactSeverity } from '@/app/screens/bridge/constants';
import { createTokenDisplayData, getTotalFeeAmount } from '@/app/utils';
import { safeOperationWithRelativeAmounts } from 'wallet-common-core';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeEstimation} BridgeEstimation */
/** @typedef {import('@/app/screens/bridge/types/Bridge').EstimationSummaryRow} EstimationSummaryRow */
/** @typedef {import('@/app/screens/bridge/types/Bridge').EstimationSummaryViewModel} EstimationSummaryViewModel */
/** @typedef {import('@/app/screens/bridge/types/Bridge').PriceImpactSeverityValue} PriceImpactSeverityValue */
/** @typedef {import('@/app/screens/bridge/types/Bridge').StepFees} StepFees */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapSide} SwapSide */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapStep} SwapStep */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Token').TokenInfo} TokenInfo */
/** @typedef {import('@/app/types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */

/**
 * One fee in one token on one chain, before or after summing.
 * @typedef {object} FeeAmount
 * @property {string} amount - Fee amount in relative units.
 * @property {string} tokenId - Fee token identifier.
 * @property {string} ticker - Units text shown after the amount.
 * @property {number} divisibility - Fee token divisibility, needed for exact sums.
 * @property {ChainName} chainName - Chain the fee is paid on.
 */

const MISSING_VALUE_TEXT = '-';

const priceImpactLevelTextKeyMap = {
	[PriceImpactSeverity.WARNING]: 's_bridge_summary_priceImpact_high',
	[PriceImpactSeverity.CRITICAL]: 's_bridge_summary_priceImpact_veryHigh'
};

/**
 * Creates a fee amount entry.
 * @param {string} amount - Fee amount in relative units.
 * @param {TokenInfo} token - Fee token.
 * @param {ChainName} chainName - Chain the fee is paid on.
 * @param {NetworkIdentifier} networkIdentifier - The network identifier.
 * @returns {FeeAmount} Fee amount entry.
 */
const createFeeAmount = (amount, token, chainName, networkIdentifier) => ({
	amount,
	tokenId: token.id,
	ticker: createTokenDisplayData(token, chainName, networkIdentifier).tickerText,
	divisibility: token.divisibility,
	chainName
});

/**
 * Creates a summary row.
 * @param {object} params - Row parameters.
 * @param {string} params.title - Localized row title.
 * @param {string} params.value - Ready value text.
 * @param {boolean} [params.isContinuation=false] - Whether the row continues the row above.
 * @param {PriceImpactSeverityValue|null} [params.severity=null] - Row severity.
 * @returns {EstimationSummaryRow} Summary row.
 */
const createRow = ({ title, value, isContinuation = false, severity = null }) => ({
	title,
	value,
	isContinuation,
	severity
});

/**
 * Adds fee amounts that share a token and chain; different tokens keep their own entry in input order.
 * A single amount passes through unchanged.
 * @param {FeeAmount[]} feeAmounts - Fee amounts in step order.
 * @returns {FeeAmount[]} Summed fee amounts.
 */
export const sumFeeAmountsByToken = feeAmounts => {
	const groups = [];

	for (const feeAmount of feeAmounts) {
		const group = groups.find(group => group.tokenId === feeAmount.tokenId && group.chainName === feeAmount.chainName);

		if (group)
			group.amounts.push(feeAmount.amount);
		else
			groups.push({ ...feeAmount, amounts: [feeAmount.amount] });
	}

	return groups.map(({ amounts, ...feeAmount }) => ({
		...feeAmount,
		amount: amounts.length === 1
			? amounts[0]
			: safeOperationWithRelativeAmounts(
				feeAmount.divisibility,
				amounts,
				(...values) => values.reduce((total, value) => total + value, 0n)
			)
	}));
};

/**
 * Builds the gas fee amounts of the steps whose tiers are loaded, in the fee tier token.
 * @param {StepFees[]} stepFees - Fee data per step.
 * @param {TransactionFeeTierLevel} transactionFeeTierLevel - The selected fee tier level.
 * @returns {FeeAmount[]|null} Summed fee amounts, or null while no step has fee tiers.
 */
const createTransactionFeeAmounts = (stepFees, transactionFeeTierLevel) => {
	const loadedStepFees = stepFees.filter(stepFee => stepFee.feeTiers !== null);

	if (!loadedStepFees.length)
		return null;

	return sumFeeAmountsByToken(loadedStepFees.map(stepFee => createFeeAmount(
		getTotalFeeAmount(stepFee.feeTiers, transactionFeeTierLevel),
		stepFee.feeTiers[0][transactionFeeTierLevel].token,
		stepFee.chainName,
		stepFee.networkIdentifier
	)));
};

/**
 * Builds the operation fee amounts of every step, each in that step's target token.
 * @param {BridgeEstimation[]|null} estimations - Per-step estimations.
 * @param {SwapStep[]} steps - Steps of the selected route.
 * @param {boolean} isComplete - Whether the estimation covers every step without an error.
 * @returns {FeeAmount[]|null} Summed fee amounts, or null without a complete, successful estimation.
 */
const createOperationFeeAmounts = (estimations, steps, isComplete) => {
	if (!isComplete)
		return null;

	return sumFeeAmountsByToken(estimations.map((estimation, stepIndex) => {
		const { targetTokenInfo, targetWalletController } = steps[stepIndex];

		return createFeeAmount(
			estimation.bridgeFee,
			targetTokenInfo,
			targetWalletController.chainName,
			targetWalletController.networkIdentifier
		);
	}));
};

/**
 * Builds the rows of one fee kind: the first amount on the titled row, the rest on continuation rows,
 * or a single placeholder row when unavailable.
 * @param {string} title - Row title.
 * @param {FeeAmount[]|null} feeAmounts - Summed fee amounts, or null when not available.
 * @returns {EstimationSummaryRow[]} Fee rows.
 */
const createFeeRows = (title, feeAmounts) => {
	if (!feeAmounts)
		return [createRow({ title, value: MISSING_VALUE_TEXT })];

	return feeAmounts.map((feeAmount, index) => createRow({
		title,
		value: `${feeAmount.amount} ${feeAmount.ticker}`,
		isContinuation: index > 0
	}));
};

/**
 * Builds the price impact row. An absent impact shows '-'; an unknown impact still carries its severity.
 * @param {number|null|undefined} priceImpact - Price impact fraction; null when unknown; undefined when absent.
 * @param {PriceImpactSeverityValue} priceImpactSeverity - Severity derived from the price impact.
 * @returns {EstimationSummaryRow} Price impact row.
 */
const createPriceImpactRow = (priceImpact, priceImpactSeverity) => {
	const title = $t('s_bridge_summary_priceImpact');

	if (priceImpact === undefined)
		return createRow({ title, value: MISSING_VALUE_TEXT });

	const severity = priceImpactSeverity === PriceImpactSeverity.NONE ? null : priceImpactSeverity;

	if (priceImpact === null)
		return createRow({ title, value: $t('s_bridge_summary_priceImpact_unknown'), severity });

	const levelText = severity ? ` · ${$t(priceImpactLevelTextKeyMap[severity])}` : '';

	return createRow({ title, value: `${formatPriceImpactText(priceImpact)}${levelText}`, severity });
};

/**
 * Builds the estimation summary view model. Rows show '-' for anything not available yet.
 * @param {object} params - Builder parameters.
 * @param {SwapSide|null} params.source - Selected source side.
 * @param {SwapSide|null} params.target - Selected target side.
 * @param {SwapStep[]} params.steps - Steps of the selected route.
 * @param {string} params.amount - Entered amount in relative units.
 * @param {StepFees[]} params.stepFees - Fee data per step; feeTiers is null until fetched.
 * @param {BridgeEstimation[]|null} params.estimations - Per-step estimations, null when absent.
 * @param {number|null|undefined} params.priceImpact - Price impact fraction; null when unknown; undefined when no step involves a swap.
 * @param {PriceImpactSeverityValue} params.priceImpactSeverity - Severity derived from the price impact.
 * @param {TransactionFeeTierLevel} params.transactionFeeTierLevel - The selected fee tier level.
 * @returns {EstimationSummaryViewModel} The card view model.
 */
export const createEstimationSummaryViewModel = ({
	source,
	target,
	steps,
	amount,
	stepFees,
	estimations,
	priceImpact,
	priceImpactSeverity,
	transactionFeeTierLevel
}) => {
	const isComplete = isEstimationComplete(estimations, steps.length);
	const sendValue = source
		? `${amount} ${createTokenDisplayData(source.token, source.chainName, source.networkIdentifier).tickerText}`
		: MISSING_VALUE_TEXT;
	const receiveAmount = target && isComplete ? estimations[estimations.length - 1].receiveAmount : null;
	const receiveValue = receiveAmount !== null
		? `${receiveAmount} ${createTokenDisplayData(target.token, target.chainName, target.networkIdentifier).tickerText}`
		: MISSING_VALUE_TEXT;

	return {
		key: `${source ? createSwapSideKey(source) : 'none'}>${target ? createSwapSideKey(target) : 'none'}`,
		rows: [
			createRow({ title: $t('s_bridge_summary_amountSend'), value: sendValue }),
			...createFeeRows($t('s_bridge_summary_transactionFee'), createTransactionFeeAmounts(stepFees, transactionFeeTierLevel)),
			...createFeeRows($t('s_bridge_summary_bridgeFee'), createOperationFeeAmounts(estimations, steps, isComplete)),
			createPriceImpactRow(priceImpact, priceImpactSeverity),
			createRow({ title: $t('s_bridge_summary_amountReceive'), value: receiveValue })
		]
	};
};
