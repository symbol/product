import { $t } from '@/app/localization';
import { HarvestingAction, HarvestingStatus } from '@/app/screens/harvesting/types/Harvesting';

/** @typedef {import('wallet-common-symbol').HarvestingStatus} HarvestingStatusData */

/**
 * Harvesting action configuration.
 * @typedef {object} HarvestingActionConfig
 * @property {boolean} isNodeSelectorVisible - Whether to show node selector.
 * @property {boolean} isActionButtonVisible - Whether to show action button.
 * @property {string|null} actionType - Action type ('start' or 'stop').
 */

/**
 * Confirmation dialog data.
 * @typedef {object} ConfirmationDialogData
 * @property {string} title - Dialog title.
 * @property {string} text - Dialog description text.
 */

/**
 * Creates the action configuration based on harvesting status and eligibility.
 * @param {HarvestingStatusData|null} harvestingStatus - Current harvesting status.
 * @param {boolean} [isEligible=false] - Whether account is eligible for harvesting.
 * @returns {HarvestingActionConfig}
 */
export const createHarvestingActionConfig = (harvestingStatus, isEligible = false) => {
	const { status } = harvestingStatus || {};
	const canStartStatuses = [HarvestingStatus.INACTIVE, HarvestingStatus.NODE_UNKNOWN];
	const canStopStatuses = [HarvestingStatus.ACTIVE, HarvestingStatus.PENDING];

	if (canStopStatuses.includes(status)) {
		return {
			isNodeSelectorVisible: false,
			isActionButtonVisible: true,
			actionType: HarvestingAction.STOP
		};
	}

	if (canStartStatuses.includes(status) && isEligible) {
		return {
			isNodeSelectorVisible: true,
			isActionButtonVisible: true,
			actionType: HarvestingAction.START
		};
	}

	return {
		isNodeSelectorVisible: false,
		isActionButtonVisible: false,
		actionType: null
	};
};

/**
 * Creates confirmation dialog data based on action type.
 * @param {string|null} actionType - The harvesting action type.
 * @returns {ConfirmationDialogData}
 */
export const createConfirmationDialogData = actionType => {
	if (actionType === HarvestingAction.START) {
		return {
			title: $t('s_harvesting_confirm_start_title'),
			text: $t('s_harvesting_confirm_start_description')
		};
	}

	return {
		title: $t('s_harvesting_confirm_stop_title'),
		text: ''
	};
};

/**
 * Gets the button text based on action type.
 * @param {string|null} actionType - The harvesting action type.
 * @returns {string}
 */
export const getActionButtonText = actionType => {
	if (actionType === HarvestingAction.START)
		return $t('button_start');

	return $t('button_stop');
};
