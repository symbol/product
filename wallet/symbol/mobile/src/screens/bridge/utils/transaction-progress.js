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
 * Status of a step's confirmation entry from its announce state and the network outcome.
 * @param {ActionState} announceStatus - State of the step's announce action.
 * @param {boolean} isConfirmed - Whether every signed transaction of the step is confirmed.
 * @param {boolean} hasFailedTransactions - Whether the network rejected a transaction of the step.
 * @returns {string} One of ActivityStatus.
 */
const getConfirmStatus = (announceStatus, isConfirmed, hasFailedTransactions) => {
	const isAnnounced = announceStatus.status === ActivityStatus.COMPLETE;

	if (isAnnounced && isConfirmed)
		return ActivityStatus.COMPLETE;
	if (hasFailedTransactions)
		return ActivityStatus.ERROR;
	if (isAnnounced)
		return ActivityStatus.LOADING;

	return ActivityStatus.PENDING;
};

/**
 * Progress of one step of a dual-step send.
 * @typedef {object} StepProgress
 * @property {ActionState} signStatus - State of the sign action.
 * @property {ActionState} announceStatus - State of the announce action.
 * @property {boolean} isConfirmed - Whether every signed transaction is confirmed.
 * @property {boolean} hasFailedTransactions - Whether the network rejected a transaction.
 * @property {boolean} isAnnounced - Whether the announce action completed.
 * @property {string[]} signedHashes - Hashes of the signed transactions.
 * @property {{from: string, to: string}} pair - Token ticker pair of the step.
 * @property {WorkflowMetaSide} source - Source side of the step.
 */

/**
 * Builds the sign, announce and confirm log items of one step.
 * @param {StepProgress} step - The step progress.
 * @param {number} stepNumber - One-based step number shown in the titles.
 * @returns {ActivityLogItem[]} The three log items.
 */
const createStepLogItems = ({
	signStatus,
	announceStatus,
	isConfirmed,
	hasFailedTransactions,
	pair
}, stepNumber) => [
	{
		title: $t('c_bridgeTransactionStatus_step_sign', { count: stepNumber, ...pair }),
		icon: 'sign',
		status: signStatus.status,
		caption: signStatus.errorMessage ?? ''
	},
	{
		title: $t('c_bridgeTransactionStatus_step_announce', { count: stepNumber, ...pair }),
		icon: 'send-plane',
		status: announceStatus.status,
		caption: announceStatus.errorMessage ?? ''
	},
	{
		title: $t('c_bridgeTransactionStatus_step_confirm', { count: stepNumber, ...pair }),
		icon: hasFailedTransactions ? 'cross' : 'check',
		status: getConfirmStatus(announceStatus, isConfirmed, hasFailedTransactions),
		caption: ''
	}
];

/**
 * Builds the seven-step activity log of a dual-step send: create, then sign, announce and confirm per step.
 * @param {object} params - Log parameters.
 * @param {ActionState} params.createStatus - State of the create action.
 * @param {StepProgress[]} params.steps - Progress of both steps in execution order.
 * @returns {ActivityLogItem[]} Activity log items.
 */
const buildProgressActivityLog = ({ createStatus, steps }) => [
	{
		title: $t('c_bridgeTransactionStatus_step_create'),
		icon: 'plus',
		status: createStatus.status,
		caption: createStatus.errorMessage ?? ''
	},
	...steps.flatMap((step, index) => createStepLogItems(step, index + 1))
];

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
 * Builds the progress of one step of a dual-step send from its managers, hashes and metadata.
 * @param {object} params - Step parameters.
 * @param {AsyncManager} params.signManager - Manager of the step's sign action.
 * @param {AsyncManager} params.announceManager - Manager of the step's announce action.
 * @param {string[]} params.signedHashes - Hashes of the signed transactions.
 * @param {string[]} params.confirmedHashes - Hashes of the confirmed transactions.
 * @param {string[]} params.failedHashes - Hashes of the transactions the network rejected.
 * @param {{from: string, to: string}} params.pair - Token ticker pair of the step.
 * @param {WorkflowMetaSide} params.source - Source side of the step.
 * @returns {StepProgress} The step progress.
 */
const createStepProgress = ({
	signManager,
	announceManager,
	signedHashes,
	confirmedHashes,
	failedHashes,
	pair,
	source
}) => ({
	signStatus: getActionStatusFromAsyncManager(signManager),
	announceStatus: getActionStatusFromAsyncManager(announceManager),
	isConfirmed: signedHashes.length > 0 && confirmedHashes.length === signedHashes.length,
	hasFailedTransactions: failedHashes.length > 0,
	isAnnounced: announceManager.isCompleted,
	signedHashes,
	pair,
	source
});

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

	const { managers, hash: hashes, meta } = workflow;
	const tokenPairsText = getTokenPairsText(workflow);
	const steps = [
		createStepProgress({
			signManager: managers.signManager1,
			announceManager: managers.announceManager1,
			signedHashes: hashes.signed1,
			confirmedHashes: hashes.confirmed1,
			failedHashes: hashes.failed1,
			pair: tokenPairsText[0],
			source: meta.step1.source
		}),
		createStepProgress({
			signManager: managers.signManager2,
			announceManager: managers.announceManager2,
			signedHashes: hashes.signed2,
			confirmedHashes: hashes.confirmed2,
			failedHashes: hashes.failed2,
			pair: tokenPairsText[1],
			source: meta.step2.source
		})
	];

	return {
		isCloseButtonDisabled: workflow.isSending,
		activityLogData: buildProgressActivityLog({
			createStatus: getActionStatusFromAsyncManager(managers.createManager1),
			steps
		}),
		statusInfo: createStatusInfo(workflow.status, tokenPairsText),
		explorerLinks: steps
			.filter(step => step.isAnnounced)
			.flatMap(step => step.signedHashes.map(hash => ({
				chainName: step.source.chainName,
				networkIdentifier: step.source.networkIdentifier,
				hash
			})))
	};
};
