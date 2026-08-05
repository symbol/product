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
 * Classifies a price impact value into a severity tier. An unknown impact (null) is classified
 * as a warning, because a value that cannot be verified is riskier than a low one. An absent
 * impact (undefined) means no swap step is involved, so no severity applies.
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
 * Formats a price impact fraction as an unsigned percent string, with a floor for dust values.
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
