import { PriceImpactSeverity } from '../constants';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeEstimation} BridgeEstimation */

/**
 * @typedef {object} PriceImpactThresholds
 * @property {number} warningThreshold - Impact fraction from which the warning tier starts.
 * @property {number} criticalThreshold - Impact fraction from which the critical tier starts.
 */

const MIN_DISPLAYED_IMPACT = 0.0001;
const PERCENT_DECIMALS = 2;

/**
 * Returns the severity tier for a price impact value.
 * @param {number|null|undefined} priceImpact - Price impact as a fraction in the [0, 1] range,
 * null when unknown, undefined when not applicable.
 * @param {PriceImpactThresholds} thresholds - Severity tier thresholds.
 * @returns {string} One of PriceImpactSeverity.
 */
export const getPriceImpactSeverity = (priceImpact, thresholds) => {
	if (priceImpact === undefined)
		return PriceImpactSeverity.NONE;

	if (priceImpact === null)
		return PriceImpactSeverity.WARNING;

	if (priceImpact >= thresholds.criticalThreshold)
		return PriceImpactSeverity.CRITICAL;

	if (priceImpact >= thresholds.warningThreshold)
		return PriceImpactSeverity.WARNING;

	return PriceImpactSeverity.NONE;
};

/**
 * Returns formatted price impact percent value.
 * @param {number|null} priceImpact - Price impact as a fraction in the [0, 1] range, or null when unknown.
 * @returns {string} Formatted percent text, or an empty string when the impact is unknown.
 */
export const formatPriceImpactText = priceImpact => {
	if (priceImpact === null)
		return '';

	if (priceImpact < MIN_DISPLAYED_IMPACT)
		return '<0.01%';

	return `${(priceImpact * 100).toFixed(PERCENT_DECIMALS)}%`;
};

/**
 * Extracts the price impact of the swap step from the estimations. Steps without a price-dependent
 * swap carry no priceImpact field, so the first estimation defining it is the swap step.
 * @param {BridgeEstimation[]|null} estimations - Estimations of all workflow steps.
 * @returns {number|null|undefined} Price impact fraction, null when unknown, undefined when no step has one.
 */
export const getEstimationsPriceImpact = estimations => {
	const swapEstimation = (estimations ?? []).find(estimation => !estimation.error && estimation.priceImpact !== undefined);

	return swapEstimation ? swapEstimation.priceImpact : undefined;
};

/**
 * Verifies that no swap step failed and every step is covered by an estimation.
 * @param {BridgeEstimation[]|null} estimations - Per-step estimations.
 * @param {number} stepCount - Number of route steps.
 * @returns {boolean} True when every step estimated successfully.
 */
export const isEstimationComplete = (estimations, stepCount) =>
	stepCount > 0 && estimations?.length === stepCount && estimations.every(estimation => !estimation.error);
