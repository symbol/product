import { constants } from 'wallet-common-symbol';

export const { HarvestingStatus } = constants;

/** @typedef {import('wallet-common-symbol').HarvestingStatus} HarvestingStatus */

/**
 * Status display configuration.
 * @typedef {object} StatusDisplayConfig
 * @property {string} statusText - Localized status text.
 * @property {string} icon - Icon name for status card.
 * @property {import('@/app/types/ColorVariants').SemanticRoleColorVariants} variant - Status card variant.
 */

/**
 * Warning display configuration.
 * @typedef {object} WarningConfig
 * @property {boolean} isVisible - Whether warning is visible.
 * @property {string} [text] - Warning text if visible.
 */

/**
 * Harvesting eligibility of an account. Each requirement is reported separately,
 * so the caller can tell the user which one is not met.
 * @typedef {object} HarvestingEligibility
 * @property {boolean} isBalanceSufficient - Whether the account balance meets the harvesting minimum.
 * @property {boolean} isImportanceSufficient - Whether the account importance meets the harvesting minimum.
 * @property {boolean} isEligible - Whether the account meets every harvesting requirement.
 */

/**
 * Harvesting status view model.
 * @typedef {object} HarvestingStatusViewModel
 * @property {StatusDisplayConfig} statusDisplay - Status display configuration.
 * @property {WarningConfig} warning - Warning configuration.
 * @property {string|null} nodeUrl - Node URL if available.
 */

/**
 * Harvesting summary view model.
 * @typedef {object} HarvestingSummaryViewModel
 * @property {boolean} hasData - Whether there is any harvesting data.
 * @property {string} latestAmount - Latest harvested amount.
 * @property {string} latestBlockNumber - Latest block number as string.
 * @property {string} latestDate - Formatted date of latest harvest.
 * @property {string} amountPer30Days - Total amount harvested in last 30 days.
 * @property {string} blocksCount - Number of blocks harvested in last 30 days (formatted for display).
 */

/**
 * Harvesting widget props.
 * @typedef {object} HarvestingWidgetProps
 * @property {HarvestingSummaryViewModel} summaryViewModel - Summary view model.
 * @property {HarvestingStatusViewModel} statusViewModel - Status view model for rendering harvesting status.
 * @property {string} ticker - Ticker symbol for the network currency.
 */

/**
 * Harvesting action types.
 * @enum {string}
 */
export const HarvestingAction = {
	START: 'start',
	STOP: 'stop'
};
