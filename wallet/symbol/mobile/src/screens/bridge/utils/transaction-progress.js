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
 * Creates a status card view model for a given swap workflow status value.
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
 * Creates extended activity (action) state with optional error message.
 * @param {string} status - One of ActivityStatus.
 * @param {string|null} [errorMessage=null] - Error message when the action failed.
 * @returns {ActionState} Action state.
 */
const createActionState = (status, errorMessage = null) => ({
	status,
	errorMessage
});

/**
 * Maps the async manager state to an action state.
 * @param {AsyncManager} asyncManager - Manager running the action.
 * @returns {ActionState} Action state.
 */
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
 * Determines the confirmation status for a step based on the network outcome and its announce state.
 * @param {ActionState} announceState - State of the step's announce action.
 * @param {boolean} isConfirmed - Whether every signed transaction of the step is confirmed.
 * @param {boolean} hasFailedTransactions - Whether the network rejected a transaction of the step.
 * @returns {string} One of ActivityStatus.
 */
const getConfirmStatus = (announceState, isConfirmed, hasFailedTransactions) => {
	const isAnnounced = announceState.status === ActivityStatus.COMPLETE;

	if (isAnnounced && isConfirmed)
		return ActivityStatus.COMPLETE;
	if (hasFailedTransactions)
		return ActivityStatus.ERROR;
	if (isAnnounced)
		return ActivityStatus.LOADING;

	return ActivityStatus.PENDING;
};

/**
 * A single step in a dual-step swap.
 * @typedef {object} WorkflowStep
 * @property {AsyncManager} signManager - Manager of the step's sign action.
 * @property {AsyncManager} announceManager - Manager of the step's announce action.
 * @property {string[]} signedHashes - Hashes of the signed transactions.
 * @property {string[]} confirmedHashes - Hashes of the confirmed transactions.
 * @property {string[]} failedHashes - Hashes of the transactions the network rejected.
 * @property {{from: string, to: string}} pair - Token ticker pair of the step.
 * @property {WorkflowMetaSide} source - Source side of the step.
 */

/**
 * Creates the sign, announce and confirm log items for one swap step.
 * @param {WorkflowStep} step - The workflow step.
 * @param {number} stepNumber - One-based step number shown in the titles.
 * @returns {ActivityLogItem[]} The three log items.
 */
const createStepLogItems = ({
	signManager,
	announceManager,
	signedHashes,
	confirmedHashes,
	failedHashes,
	pair
}, stepNumber) => {
	const signState = getActionStateFromAsyncManager(signManager);
	const announceState = getActionStateFromAsyncManager(announceManager);
	const isConfirmed = signedHashes.length > 0 && confirmedHashes.length === signedHashes.length;
	const hasFailedTransactions = failedHashes.length > 0;

	return [
		{
			title: $t('c_bridgeTransactionStatus_step_sign', { count: stepNumber, ...pair }),
			icon: 'sign',
			status: signState.status,
			caption: signState.errorMessage ?? ''
		},
		{
			title: $t('c_bridgeTransactionStatus_step_announce', { count: stepNumber, ...pair }),
			icon: 'send-plane',
			status: announceState.status,
			caption: announceState.errorMessage ?? ''
		},
		{
			title: $t('c_bridgeTransactionStatus_step_confirm', { count: stepNumber, ...pair }),
			icon: hasFailedTransactions ? 'cross' : 'check',
			status: getConfirmStatus(announceState, isConfirmed, hasFailedTransactions),
			caption: ''
		}
	];
};

/**
 * Retrieves the token label for a workflow side, returning its name if unlisted or its known ticker.
 * @param {WorkflowMetaSide} side - The workflow side.
 * @returns {string} Ticker text, or 'unknown' for a side without token info.
 */
const createTokenTextFromSide = side => {
	if (!side?.tokenInfo?.id)
		return UNKNOWN_TOKEN_TEXT;

	return createTokenDisplayData(side.tokenInfo, side.chainName, side.networkIdentifier).tickerText;
};

/**
 * Creates the display text for each step in a dual-step workflow.
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
 * Creates the swap transaction progress dialog view model.
 * @param {object} workflow - Single or dual-step workflow.
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

	const { managers, hash: hashes, meta } = workflow;
	const tokenPairsText = getTokenPairsText(workflow);
	const createState = getActionStateFromAsyncManager(managers.createManager1);
	/** @type {WorkflowStep[]} */
	const steps = [
		{
			signManager: managers.signManager1,
			announceManager: managers.announceManager1,
			signedHashes: hashes.signed1,
			confirmedHashes: hashes.confirmed1,
			failedHashes: hashes.failed1,
			pair: tokenPairsText[0],
			source: meta.step1.source
		},
		{
			signManager: managers.signManager2,
			announceManager: managers.announceManager2,
			signedHashes: hashes.signed2,
			confirmedHashes: hashes.confirmed2,
			failedHashes: hashes.failed2,
			pair: tokenPairsText[1],
			source: meta.step2.source
		}
	];

	return {
		isCloseButtonDisabled: workflow.isSending,
		activityLogData: [
			{
				title: $t('c_bridgeTransactionStatus_step_create'),
				icon: 'plus',
				status: createState.status,
				caption: createState.errorMessage ?? ''
			},
			...steps.flatMap((step, index) => createStepLogItems(step, index + 1))
		],
		statusInfo: createStatusInfo(workflow.status, tokenPairsText),
		explorerLinks: steps
			.filter(step => step.announceManager.isCompleted)
			.flatMap(step => step.signedHashes.map(hash => ({
				chainName: step.source.chainName,
				networkIdentifier: step.source.networkIdentifier,
				hash
			})))
	};
};
