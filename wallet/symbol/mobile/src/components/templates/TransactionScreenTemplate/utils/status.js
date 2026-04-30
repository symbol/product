import { TransactionStatusInfoType } from '../constants';
import { ActivityStatus } from '@/app/constants';

/** @typedef {import('@/app/types/Action').ActionStatus} ActionStatus */

/** @typedef {import('@/app/types/Action').ActionState} ActionState */

/** @typedef {import('@/app/types/AsyncManager').AsyncManager} AsyncManager */

/** @typedef {import('@/app/types/ColorVariants').SemanticRoleColorVariants} SemanticRoleColorVariants */

/**
 * Resolved status information including icon, type, and visual variant for display.
 * @typedef {object} StatusInfo
 * @property {string} type - The transaction status info type from TransactionStatusInfoType.
 * @property {string} icon - Icon name to display for the status.
 * @property {SemanticRoleColorVariants} variant - Visual variant for styling the status indicator.
 */

/**
 * Input parameters for determining the overall transaction status info.
 * @typedef {object} StatusInfoParams
 * @property {ActionState} createStatus - Current status of the transaction creation step.
 * @property {ActionState} signStatus - Current status of the transaction signing step.
 * @property {ActionState} announceStatus - Current status of the transaction announcement step.
 * @property {boolean} isAllTransactionsConfirmed - Whether all transactions in the bundle have been confirmed.
 * @property {boolean} hasFailedTransactions - Whether any transactions in the bundle have failed.
 * @property {boolean} isPartialState - Whether the transaction is in a partial/multisig pending state.
 */

const createActionStatus = (status, errorMessage = null) => ({
	status,
	errorMessage
});

/**
 * Derives an action status from an async manager's current state.
 * Maps the async manager's loading, error, and completion states to corresponding action statuses.
 * @param {AsyncManager} asyncManager - The async manager instance to derive status from.
 * @returns {ActionState} Action state derived from the async manager's current state.
 */
export const getActionStatusFromAsyncManager = asyncManager => {
	if (asyncManager.isLoading) 
		return createActionStatus(ActivityStatus.LOADING);
    
	if (asyncManager.error) 
		return createActionStatus(ActivityStatus.ERROR, asyncManager.error.message);
    
	if (asyncManager.isCompleted) 
		return createActionStatus(ActivityStatus.COMPLETE);
    
	return createActionStatus(ActivityStatus.PENDING);
};

const isCompleted = actionStatus => actionStatus?.status === ActivityStatus.COMPLETE;
const isLoading = actionStatus => actionStatus?.status === ActivityStatus.LOADING;
const isError = actionStatus => actionStatus?.status === ActivityStatus.ERROR;

/**
 * Determines the overall transaction status information based on the current state of all workflow steps.
 * Evaluates create, sign, and announce statuses along with confirmation state to return appropriate
 * status type, icon, and visual variant for display.
 * @param {StatusInfoParams} params - Parameters containing all workflow step statuses.
 * @returns {StatusInfo} Status information object with type, icon, and variant for UI display.
 */
export const getStatusInfo = ({
	createStatus,
	signStatus,
	announceStatus,
	isAllTransactionsConfirmed,
	hasFailedTransactions,
	isPartialState
}) => {
	const isSending = isLoading(createStatus) || isLoading(signStatus) || isLoading(announceStatus);
	const hasAnyError = isError(createStatus) || isError(signStatus) || isError(announceStatus);
	const isCreatedAndNotSent = isCompleted(createStatus) && !isCompleted(signStatus) && !isCompleted(announceStatus) && !hasAnyError;

	if (isSending || isCreatedAndNotSent) {
		return {
			type: TransactionStatusInfoType.SENDING,
			icon: 'pending',
			variant: 'warning'
		};
	}

	if (isAllTransactionsConfirmed) {
		return {
			type: TransactionStatusInfoType.CONFIRMED,
			icon: 'check-circle',
			variant: 'success'
		};
	}

	if (isError(createStatus)) {
		return {
			type: TransactionStatusInfoType.CREATE_ERROR,
			icon: 'cross-circle',
			variant: 'danger'
		};
	}

	if (isError(signStatus)) {
		return {
			type: TransactionStatusInfoType.SIGN_ERROR,
			icon: 'cross-circle',
			variant: 'danger'
		};
	}

	if (isError(announceStatus)) {
		return {
			type: TransactionStatusInfoType.ANNOUNCE_ERROR,
			icon: 'cross-circle',
			variant: 'danger'
		};
	}

	if (hasFailedTransactions) {
		return {
			type: TransactionStatusInfoType.FAILED_TRANSACTIONS,
			icon: 'cross-circle',
			variant: 'danger'
		};
	}

	if (isPartialState) {
		return {
			type: TransactionStatusInfoType.PARTIAL,
			icon: 'check-circle',
			variant: 'neutral'
		};
	}

	return {
		type: TransactionStatusInfoType.CONFIRMING,
		icon: 'check-circle',
		variant: 'neutral'
	};
};
