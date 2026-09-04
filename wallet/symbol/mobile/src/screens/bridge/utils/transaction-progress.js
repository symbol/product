import { BridgeTransactionWorkflowStatus } from '../constants';
import {
	createTransactionProgressViewModel as createStandardTransactionProgressViewModel
} from '@/app/components/templates/TransactionScreenTemplate/utils';
import { ActivityStatus } from '@/app/constants';
import { $t } from '@/app/localization';
import { createTokenDisplayData } from '@/app/utils';

/** @typedef {import('@/app/screens/bridge/types/Bridge').DualWorkflowMeta} DualWorkflowMeta */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SingleWorkflowMeta} SingleWorkflowMeta */
/** @typedef {import('@/app/screens/bridge/types/Bridge').WorkflowMetaSide} WorkflowMetaSide */
/** @typedef {import('@/app/types/Action').ActionState} ActionState */
/** @typedef {import('@/app/types/ActivityLog').ActivityLogItem} ActivityLogItem */
/** @typedef {import('@/app/types/AsyncManager').AsyncManager} AsyncManager */
// eslint-disable-next-line max-len
/** @typedef {import('@/app/components/templates/TransactionScreenTemplate/types/TransactionProgress').TransactionProgressViewModel} TransactionProgressViewModel */

const UNKNOWN_TOKEN_TEXT = 'unknown';

/**
 * Maps a BridgeTransactionWorkflowStatus value to its full display info: icon, variant, and localised text.
 * @param {string} status - A BridgeTransactionWorkflowStatus value.
 * @param {Array<{from: string, to: string}>} tokenPairsText - Token ticker pairs for each step.
 * @returns {object} Display info for the given status.
 */
const createStatusInfo = (status, tokenPairsText) => {
	const pair1 = tokenPairsText[0];
	const pair2 = tokenPairsText[1];
	const unknownStatus = {
		icon: 'question-circle',
		variant: 'neutral',
		title: $t('c_bridgeTransactionStatus_status_unknown_title'),
		description: $t('c_bridgeTransactionStatus_status_unknown_description')
	};
	const sendingStatus = {
		icon: 'pending',
		variant: 'warning',
		title: $t('c_bridgeTransactionStatus_status_sending_title'),
		description: $t('c_bridgeTransactionStatus_status_sending_description')
	};
	const step1SendingStatus = {
		icon: 'pending',
		variant: 'warning',
		title: $t('c_bridgeTransactionStatus_status_sending_title'),
		description: $t('c_bridgeTransactionStatus_status_step_sending_description', pair1)
	};
	const step2SendingStatus = {
		icon: 'pending',
		variant: 'warning',
		title: $t('c_bridgeTransactionStatus_status_sending_title'),
		description: $t('c_bridgeTransactionStatus_status_step_sending_description', pair2)
	};

	const infoMap = {
		[BridgeTransactionWorkflowStatus.IDLE]: sendingStatus,
		[BridgeTransactionWorkflowStatus.CREATING]: sendingStatus,
		[BridgeTransactionWorkflowStatus.CREATE_ERROR]: {
			icon: 'cross-circle',
			variant: 'danger',
			title: $t('c_bridgeTransactionStatus_status_createError_title'),
			description: $t('c_bridgeTransactionStatus_status_createError_description')
		},
		[BridgeTransactionWorkflowStatus.CREATED]: sendingStatus,
		[BridgeTransactionWorkflowStatus.SIGNING_1]: step1SendingStatus,
		[BridgeTransactionWorkflowStatus.SIGN_ERROR_1]: {
			icon: 'cross-circle',
			variant: 'danger',
			title: $t('c_bridgeTransactionStatus_status_signError_title'),
			description: $t('c_bridgeTransactionStatus_status_signError_description', pair1)
		},
		[BridgeTransactionWorkflowStatus.SIGNED_1]: step1SendingStatus,
		[BridgeTransactionWorkflowStatus.ANNOUNCING_1]: step1SendingStatus,
		[BridgeTransactionWorkflowStatus.ANNOUNCE_ERROR_1]: {
			icon: 'cross-circle',
			variant: 'danger',
			title: $t('c_bridgeTransactionStatus_status_announceError_title'),
			description: $t('c_bridgeTransactionStatus_status_announceError_description', pair1)
		},
		[BridgeTransactionWorkflowStatus.ANNOUNCED_1]: step1SendingStatus,
		[BridgeTransactionWorkflowStatus.CONFIRMED_1]: step1SendingStatus,
		[BridgeTransactionWorkflowStatus.FAILED_1]: {
			icon: 'cross-circle',
			variant: 'danger',
			title: $t('c_bridgeTransactionStatus_status_failedTransaction_title'),
			description: $t('c_bridgeTransactionStatus_status_failedTransaction_description', pair1)
		},
		[BridgeTransactionWorkflowStatus.SIGNING_2]: step2SendingStatus,
		[BridgeTransactionWorkflowStatus.SIGN_ERROR_2]: {
			icon: 'cross-circle',
			variant: 'danger',
			title: $t('c_bridgeTransactionStatus_status_signError_title'),
			description: $t('c_bridgeTransactionStatus_status_signError_description', pair2)
		},
		[BridgeTransactionWorkflowStatus.SIGNED_2]: step2SendingStatus,
		[BridgeTransactionWorkflowStatus.ANNOUNCING_2]: step2SendingStatus,
		[BridgeTransactionWorkflowStatus.ANNOUNCE_ERROR_2]: {
			icon: 'cross-circle',
			variant: 'danger',
			title: $t('c_bridgeTransactionStatus_status_announceError_title'),
			description: $t('c_bridgeTransactionStatus_status_announceError_description', pair2)
		},
		[BridgeTransactionWorkflowStatus.ANNOUNCED_2]: {
			icon: 'check-circle',
			variant: 'neutral',
			title: $t('c_bridgeTransactionStatus_status_confirming_title'),
			description: $t('c_bridgeTransactionStatus_status_confirming_description', pair2)
		},
		[BridgeTransactionWorkflowStatus.CONFIRMED_2]: {
			icon: 'check-circle',
			variant: 'success',
			title: $t('c_bridgeTransactionStatus_status_confirmed_title'),
			description: $t('c_bridgeTransactionStatus_status_confirmed_description')
		},
		[BridgeTransactionWorkflowStatus.FAILED_2]: {
			icon: 'cross-circle',
			variant: 'danger',
			title: $t('c_bridgeTransactionStatus_status_failedTransaction_title'),
			description: $t('c_bridgeTransactionStatus_status_failedTransaction_description', pair2)
		}
	};

	return infoMap[status] ?? unknownStatus;
};

/**
 * Creates the state of one send action.
 * @param {string} status - One of ActivityStatus.
 * @param {string|null} [errorMessage=null] - Error message when the action failed.
 * @returns {ActionState} Action state.
 */
const createActionStatus = (status, errorMessage = null) => ({
	status,
	errorMessage
});

/**
 * Maps an async manager's state to the state of its send action.
 * @param {AsyncManager} asyncManager - Manager running the action.
 * @returns {ActionState} Action state.
 */
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
 * Builds the seven-step activity log of a dual-step send: create, then sign, announce and confirm per step.
 * @param {object} params - Log parameters.
 * @param {ActionState} params.createStatus - State of the create action.
 * @param {ActionState} params.signStatus1 - State of the first step's sign action.
 * @param {ActionState} params.announceStatus1 - State of the first step's announce action.
 * @param {boolean} params.isStep1Confirmed - Whether every first-step transaction is confirmed.
 * @param {boolean} params.hasStep1FailedTransactions - Whether the network rejected a first-step transaction.
 * @param {ActionState} params.signStatus2 - State of the second step's sign action.
 * @param {ActionState} params.announceStatus2 - State of the second step's announce action.
 * @param {boolean} params.isStep2Confirmed - Whether every second-step transaction is confirmed.
 * @param {boolean} params.hasStep2FailedTransactions - Whether the network rejected a second-step transaction.
 * @param {Array<{from: string, to: string}>} params.tokenPairsText - Token ticker pairs for each step.
 * @returns {ActivityLogItem[]} Activity log items.
 */
const buildProgressActivityLog = ({
	createStatus,
	signStatus1,
	announceStatus1,
	isStep1Confirmed,
	hasStep1FailedTransactions,
	signStatus2,
	announceStatus2,
	isStep2Confirmed,
	hasStep2FailedTransactions,
	tokenPairsText
}) => {
	const getConfirmStatus1 = () => {
		const isAnnounced = announceStatus1.status === ActivityStatus.COMPLETE;

		if (isAnnounced && isStep1Confirmed)
			return ActivityStatus.COMPLETE;
		if (hasStep1FailedTransactions)
			return ActivityStatus.ERROR;
		if (isAnnounced)
			return ActivityStatus.LOADING;
		return ActivityStatus.PENDING;
	};

	const getConfirmStatus2 = () => {
		const isAnnounced = announceStatus2.status === ActivityStatus.COMPLETE;

		if (isAnnounced && isStep2Confirmed)
			return ActivityStatus.COMPLETE;
		if (hasStep2FailedTransactions)
			return ActivityStatus.ERROR;
		if (isAnnounced)
			return ActivityStatus.LOADING;
		return ActivityStatus.PENDING;
	};

	const pair1 = tokenPairsText[0];
	const pair2 = tokenPairsText[1];

	return [
		{
			title: $t('c_bridgeTransactionStatus_step_create'),
			icon: 'plus',
			status: createStatus.status,
			caption: createStatus.errorMessage ?? ''
		},
		{
			title: $t('c_bridgeTransactionStatus_step_sign', { count: 1, ...pair1 }),
			icon: 'sign',
			status: signStatus1.status,
			caption: signStatus1.errorMessage ?? ''
		},
		{
			title: $t('c_bridgeTransactionStatus_step_announce', { count: 1, ...pair1 }),
			icon: 'send-plane',
			status: announceStatus1.status,
			caption: announceStatus1.errorMessage ?? ''
		},
		{
			title: $t('c_bridgeTransactionStatus_step_confirm', { count: 1, ...pair1 }),
			icon: hasStep1FailedTransactions ? 'cross' : 'check',
			status: getConfirmStatus1(),
			caption: ''
		},
		{
			title: $t('c_bridgeTransactionStatus_step_sign', { count: 2, ...pair2 }),
			icon: 'sign',
			status: signStatus2.status,
			caption: signStatus2.errorMessage ?? ''
		},
		{
			title: $t('c_bridgeTransactionStatus_step_announce', { count: 2, ...pair2 }),
			icon: 'send-plane',
			status: announceStatus2.status,
			caption: announceStatus2.errorMessage ?? ''
		},
		{
			title: $t('c_bridgeTransactionStatus_step_confirm', { count: 2, ...pair2 }),
			icon: hasStep2FailedTransactions ? 'cross' : 'check',
			status: getConfirmStatus2(),
			caption: ''
		}
	];
};

/**
 * Resolves the label of a workflow side's token: its known ticker, or its name when unlisted.
 * @param {WorkflowMetaSide} side - The workflow metadata side containing tokenInfo, chainName and networkIdentifier.
 * @returns {string} Ticker text, or 'unknown' for a side without token info.
 */
const createTokenTextFromSide = side => {
	if (!side?.tokenInfo?.id)
		return UNKNOWN_TOKEN_TEXT;

	return createTokenDisplayData(side.tokenInfo, side.chainName, side.networkIdentifier).tickerText;
};

/**
 * Builds the token pair display text for each step of a dual-step workflow.
 * @param {object} workflow - The dual-step workflow object with {@link DualWorkflowMeta} on `meta`.
 * @returns {Array<{from: string, to: string}>} Token ticker pairs for each step.
 */
const getTokenPairsText = workflow => {
	const { step1, step2 } = workflow.meta;

	return [
		{
			from: createTokenTextFromSide(step1.source),
			to: createTokenTextFromSide(step1.target)
		},
		{
			from: createTokenTextFromSide(step2.source),
			to: createTokenTextFromSide(step2.target)
		}
	];
};

/**
 * Builds the progress dialog view model of a swap: the standard one for a single-step route; for a
 * dual-step route, the seven-step log, the combined status and the explorer links of both steps.
 * @param {object} workflow - The active workflow with {@link SingleWorkflowMeta} or {@link DualWorkflowMeta} on `meta`.
 * @returns {TransactionProgressViewModel} Progress view model.
 */
export const createTransactionProgressViewModel = workflow => {
	if (workflow.steps === 1) {
		return createStandardTransactionProgressViewModel(
			workflow,
			workflow.meta.source.chainName,
			workflow.meta.source.networkIdentifier
		);
	}

	const tokenPairsText = getTokenPairsText(workflow);

	const createStatus = getActionStatusFromAsyncManager(workflow.managers.createManager1);
	const signStatus1 = getActionStatusFromAsyncManager(workflow.managers.signManager1);
	const announceStatus1 = getActionStatusFromAsyncManager(workflow.managers.announceManager1);
	const signStatus2 = getActionStatusFromAsyncManager(workflow.managers.signManager2);
	const announceStatus2 = getActionStatusFromAsyncManager(workflow.managers.announceManager2);

	const isStep1Confirmed = workflow.hash.signed1.length > 0
        && workflow.hash.confirmed1.length === workflow.hash.signed1.length;
	const hasStep1FailedTransactions = workflow.hash.failed1.length > 0;
	const isStep2Confirmed = workflow.hash.signed2.length > 0
        && workflow.hash.confirmed2.length === workflow.hash.signed2.length;
	const hasStep2FailedTransactions = workflow.hash.failed2.length > 0;

	const activityLogData = buildProgressActivityLog({
		createStatus,
		signStatus1,
		announceStatus1,
		isStep1Confirmed,
		hasStep1FailedTransactions,
		signStatus2,
		announceStatus2,
		isStep2Confirmed,
		hasStep2FailedTransactions,
		tokenPairsText
	});

	const statusInfo = createStatusInfo(workflow.status, tokenPairsText);

	const isStep1Announced = workflow.managers.announceManager1.isCompleted;
	const isStep2Announced = workflow.managers.announceManager2.isCompleted;

	const explorerLinks = [
		...(isStep1Announced ? workflow.hash.signed1.map(hash => ({
			chainName: workflow.meta?.step1.source.chainName,
			networkIdentifier: workflow.meta?.step1.source.networkIdentifier,
			hash
		})) : []),
		...(isStep2Announced ? workflow.hash.signed2.map(hash => ({
			chainName: workflow.meta?.step2.source.chainName,
			networkIdentifier: workflow.meta?.step2.source.networkIdentifier,
			hash
		})) : [])
	];

	return {
		isCloseButtonDisabled: workflow.isSending,
		activityLogData,
		statusInfo,
		explorerLinks
	};
};
