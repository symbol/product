import { TransactionWorkflowStatus } from '../constants';
import { ActivityStatus } from '@/app/constants';
import { $t } from '@/app/localization';

/** @typedef {import('@/app/types/Action').ActionState} ActionState */
/** @typedef {import('@/app/types/ActivityLog').ActivityLogItem} ActivityLogItem */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('../types/Workflow').StandardTransactionWorkflow} StandardTransactionWorkflow */
/** @typedef {import('../types/TransactionProgress').StatusInfo} StatusInfo */
/** @typedef {import('../types/TransactionProgress').TransactionProgressViewModel} TransactionProgressViewModel */


/**
 * Maps a TransactionWorkflowStatus value to its full display info: icon, variant, and localised text.
 * $t is called inside the function so localisation updates are picked up on every render.
 * @param {string} status - A TransactionWorkflowStatus value.
 * @returns {StatusInfo} Display info for the given status.
 */
const createStatusInfo = status => {
	const unknownStatus = {
		icon: 'question-circle',
		variant: 'neutral',
		title: $t('c_transactionStatus_status_unknown_title'),
		description: $t('c_transactionStatus_status_unknown_description')
	};
	const sendingStatus = {
		icon: 'pending',
		variant: 'warning',
		title: $t('c_transactionStatus_status_sending_title'),
		description: $t('c_transactionStatus_status_sending_description')
	};

	const infoMap = {
		[TransactionWorkflowStatus.IDLE]: sendingStatus,
		[TransactionWorkflowStatus.CREATING]: sendingStatus,
		[TransactionWorkflowStatus.CREATED]: sendingStatus,
		[TransactionWorkflowStatus.SIGNING]: sendingStatus,
		[TransactionWorkflowStatus.SIGNED]: sendingStatus,
		[TransactionWorkflowStatus.ANNOUNCING]: sendingStatus,
		[TransactionWorkflowStatus.ANNOUNCED]: {
			icon: 'check-circle',
			variant: 'neutral',
			title: $t('c_transactionStatus_status_confirming_title'),
			description: $t('c_transactionStatus_status_confirming_description')
		},
		[TransactionWorkflowStatus.PARTIAL]: {
			icon: 'check-circle',
			variant: 'neutral',
			title: $t('c_transactionStatus_status_partial_title'),
			description: $t('c_transactionStatus_status_partial_description')
		},
		[TransactionWorkflowStatus.CONFIRMED]: {
			icon: 'check-circle',
			variant: 'success',
			title: $t('c_transactionStatus_status_confirmed_title'),
			description: $t('c_transactionStatus_status_confirmed_description')
		},
		[TransactionWorkflowStatus.CREATE_ERROR]: {
			icon: 'cross-circle',
			variant: 'danger',
			title: $t('c_transactionStatus_status_createError_title'),
			description: $t('c_transactionStatus_status_createError_description')
		},
		[TransactionWorkflowStatus.SIGN_ERROR]: {
			icon: 'cross-circle',
			variant: 'danger',
			title: $t('c_transactionStatus_status_signError_title'),
			description: $t('c_transactionStatus_status_signError_description')
		},
		[TransactionWorkflowStatus.ANNOUNCE_ERROR]: {
			icon: 'cross-circle',
			variant: 'danger',
			title: $t('c_transactionStatus_status_announceError_title'),
			description: $t('c_transactionStatus_status_announceError_description')
		},
		[TransactionWorkflowStatus.FAILED_TRANSACTIONS]: {
			icon: 'cross-circle',
			variant: 'danger',
			title: $t('c_transactionStatus_status_failedTransaction_title'),
			description: $t('c_transactionStatus_status_failedTransaction_description')
		}
	};

	return infoMap[status] ?? unknownStatus;
};

const createActionStatus = (status, errorMessage = null) => ({
	status,
	errorMessage
});

const getActionStatusFromAsyncManager = asyncManager => {
	if (asyncManager.isLoading)
		return createActionStatus(ActivityStatus.LOADING);

	if (asyncManager.error)
		return createActionStatus(ActivityStatus.ERROR, asyncManager.error.message);

	if (asyncManager.isCompleted)
		return createActionStatus(ActivityStatus.COMPLETE);

	return createActionStatus(ActivityStatus.PENDING);
};

/**
 * Parameters for building the transaction workflow activity log.
 * @typedef {object} BuildActivityLogParams
 * @property {ActionState} createStatus - Current status of the transaction creation step.
 * @property {ActionState} signStatus - Current status of the transaction signing step.
 * @property {ActionState} announceStatus - Current status of the transaction announcement step.
 * @property {boolean} isAllTransactionsConfirmed - Whether all transactions in the bundle have been confirmed on the network.
 * @property {boolean} hasFailedTransactions - Whether any transactions in the bundle were rejected by the network.
 */

/**
 * Builds an activity log array representing the transaction workflow steps.
 * @param {BuildActivityLogParams} params - Parameters containing all workflow step statuses and confirmation state.
 * @returns {ActivityLogItem[]} Array of activity log steps representing the complete transaction workflow.
 */
const buildActivityLog = ({
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
			title: $t('c_transactionStatus_step_create'),
			icon: 'plus',
			status: createStatus.status,
			caption: createStatus.errorMessage ?? ''
		},
		{
			title: $t('c_transactionStatus_step_sign'),
			icon: 'sign',
			status: signStatus.status,
			caption: signStatus.errorMessage ?? ''
		},
		{
			title: $t('c_transactionStatus_step_announce'),
			icon: 'send-plane',
			status: announceStatus.status,
			caption: announceStatus.errorMessage ?? ''
		},
		{
			title: $t('c_transactionStatus_step_confirm'),
			icon: hasFailedTransactions ? 'cross' : 'check',
			status: getConfirmStatus(),
			caption: ''
		}
	];
};

/**
 * Creates a TransactionProgressViewModel from the current workflow state.
 * Derives all display data needed by the transaction status dialog, using the workflow's
 * pre-computed boolean flags and status values instead of re-deriving them.
 * @param {StandardTransactionWorkflow} workflow - The transaction workflow state.
 * @param {ChainName} chainName - The name of the blockchain network.
 * @param {NetworkIdentifier} networkIdentifier - The identifier of the blockchain network.
 * @returns {TransactionProgressViewModel} View model for the transaction status dialog.
 */
export const createTransactionProgressViewModel = (workflow, chainName, networkIdentifier) => {
	const createStatus = getActionStatusFromAsyncManager(workflow.managers.createManager);
	const signStatus = getActionStatusFromAsyncManager(workflow.managers.signManager);
	const announceStatus = getActionStatusFromAsyncManager(workflow.managers.announceManager);

	const activityLogData = buildActivityLog({
		createStatus,
		signStatus,
		announceStatus,
		isAllTransactionsConfirmed: workflow.status === TransactionWorkflowStatus.CONFIRMED,
		hasFailedTransactions: workflow.status === TransactionWorkflowStatus.FAILED_TRANSACTIONS
	});

	const statusInfo = createStatusInfo(workflow.status);

	const explorerLinks = workflow.isSent
		? workflow.hashes.signed.map(hash => ({
			chainName: chainName,
			networkIdentifier: networkIdentifier,
			hash
		}))
		: [];

	return {
		isCloseButtonDisabled: workflow.isSending,
		activityLogData,
		statusInfo,
		explorerLinks
	};
};
