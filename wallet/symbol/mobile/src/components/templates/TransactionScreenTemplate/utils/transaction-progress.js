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

const createActionState = (status, errorMessage = null) => ({
	status,
	errorMessage
});

const getActionStateFromAsyncManager = asyncManager => {
	if (asyncManager.isLoading)
		return createActionState(ActivityStatus.LOADING);

	if (asyncManager.error)
		return createActionState(ActivityStatus.ERROR, asyncManager.error.message);

	if (asyncManager.isCompleted)
		return createActionState(ActivityStatus.COMPLETE);

	return createActionState(ActivityStatus.PENDING);
};

/**
 * Parameters for building the transaction workflow activity log.
 * @typedef {object} BuildActivityLogParams
 * @property {ActionState} createState - Current state of the transaction creation step.
 * @property {ActionState} signState - Current state of the transaction signing step.
 * @property {ActionState} announceState - Current state of the transaction announcement step.
 * @property {boolean} isAllTransactionsConfirmed - Whether all transactions in the bundle have been confirmed on the network.
 * @property {boolean} hasFailedTransactions - Whether any transactions in the bundle were rejected by the network.
 */

/**
 * Builds an activity log array representing the transaction workflow steps.
 * @param {BuildActivityLogParams} params - Parameters containing all workflow step statuses and confirmation state.
 * @returns {ActivityLogItem[]} Array of activity log steps representing the complete transaction workflow.
 */
const buildActivityLog = ({
	createState,
	signState,
	announceState,
	isAllTransactionsConfirmed,
	hasFailedTransactions
}) => {
	const getConfirmStatus = () => {
		const isAllTransactionsAnnounced = announceState.status === ActivityStatus.COMPLETE;

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
			status: createState.status,
			caption: createState.errorMessage ?? ''
		},
		{
			title: $t('c_transactionStatus_step_sign'),
			icon: 'sign',
			status: signState.status,
			caption: signState.errorMessage ?? ''
		},
		{
			title: $t('c_transactionStatus_step_announce'),
			icon: 'send-plane',
			status: announceState.status,
			caption: announceState.errorMessage ?? ''
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
	const createState = getActionStateFromAsyncManager(workflow.managers.createManager);
	const signState = getActionStateFromAsyncManager(workflow.managers.signManager);
	const announceState = getActionStateFromAsyncManager(workflow.managers.announceManager);

	const activityLogData = buildActivityLog({
		createState,
		signState,
		announceState,
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
