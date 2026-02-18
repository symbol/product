import { TransactionStatusStep } from '@/app/components/templates/TransactionScreenTemplate/constants';
import { ActivityStatus } from '@/app/constants';

/** @typedef {import('@/app/types/Action').ActionState} ActionState */

/** @typedef {import('@/app/types/Action').ActionStatus} ActionStatus */

/** @typedef {import('@/app/types/ActivityLog').ActivityLogItem} ActivityLogItem */

/**
 * @typedef {Object} ActivityLogStep
 * @property {string} type - The transaction status step type from TransactionStatusStep
 * @property {string} icon - Icon name to display for the step
 * @property {ActionStatus} status - Current status of the step
 * @property {string} caption - Additional caption text, typically error messages
 */

/**
 * @typedef {Object} BuildActivityLogParams
 * @property {ActionState} createStatus - Current status of the transaction creation step
 * @property {ActionState} signStatus - Current status of the transaction signing step
 * @property {ActionState} announceStatus - Current status of the transaction announcement step
 * @property {boolean} isAllTransactionsConfirmed - Whether all transactions in the bundle have been confirmed on the network
 * @property {boolean} hasFailedTransactions - Whether any transactions in the bundle were rejected by the network
 */

/**
 * Builds an activity log array representing the transaction workflow steps.
 * Each step (create, sign, announce, confirm) includes its current status, icon, and any error messages.
 * The confirmation step's status is dynamically calculated based on announcement and confirmation states.
 * 
 * @param {BuildActivityLogParams} params - Parameters containing all workflow step statuses and confirmation state
 * @returns {ActivityLogStep[]} Array of activity log steps representing the complete transaction workflow
 */
export const buildActivityLog = ({
	createStatus,
	signStatus,
	announceStatus,
	isAllTransactionsConfirmed,
	hasFailedTransactions
}) => {
	const getConfirmStatus = () => {
		const isAllTransactionsAnnounced = announceStatus.status === ActivityStatus.COMPLETE;

		if (isAllTransactionsAnnounced && isAllTransactionsConfirmed)
			return ActivityStatus.COMPLETE;

		if (hasFailedTransactions)
			return ActivityStatus.ERROR;

		if (isAllTransactionsAnnounced && !isAllTransactionsConfirmed)
			return ActivityStatus.LOADING;

		return ActivityStatus.PENDING;
	};

	return [
		{
			type: TransactionStatusStep.CREATE,
			icon: 'plus',
			status: createStatus.status,
			caption: createStatus.errorMessage ?? ''
		},
		{
			type: TransactionStatusStep.SIGN,
			icon: 'sign',
			status: signStatus.status,
			caption: signStatus.errorMessage ?? ''
		},
		{
			type: TransactionStatusStep.ANNOUNCE,
			icon: 'send-plane',
			status: announceStatus.status,
			caption: announceStatus.errorMessage ?? ''
		},
		{
			type: TransactionStatusStep.CONFIRM,
			icon: hasFailedTransactions ? 'cross' : 'check',
			status: getConfirmStatus(),
			caption: ''
		}
	];
};
