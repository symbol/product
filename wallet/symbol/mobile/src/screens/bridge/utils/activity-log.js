import { ActivityStatus } from '@/app/constants';
import { $t } from '@/app/localization';
import { BridgePayoutStatus, BridgeRequestStatus } from '@/app/screens/bridge/types/Bridge';
import { formatDate } from '@/app/utils';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeRequestStatusType} BridgeRequestStatusType */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgePayoutStatusType} BridgePayoutStatusType */
/** @typedef {import('@/app/types/ActivityLog').ActivityLogItem} ActivityLogItem */

/**
 * Parameters for building activity log.
 * @typedef {Object} BuildActivityLogParams
 * @property {BridgeRequestStatusType} requestStatus - Request transaction status.
 * @property {BridgePayoutStatusType} [payoutStatus] - Payout transaction status.
 * @property {number} [requestTimestamp] - Request transaction timestamp.
 * @property {number} [payoutTimestamp] - Payout transaction timestamp.
 * @property {string} [errorMessage] - Error message if failed.
 */

/**
 * Builds an activity log array representing the token swap workflow steps.
 * @param {BuildActivityLogParams} params - Parameters for building the activity log.
 * @returns {ActivityLogItem[]} Array of activity log steps.
 */
export const buildActivityLog = ({
	requestStatus,
	payoutStatus,
	requestTimestamp,
	payoutTimestamp,
	errorMessage
}) => {
	const isRequestConfirmed = requestStatus === BridgeRequestStatus.CONFIRMED;
	const isRequestFailed = requestStatus === BridgeRequestStatus.ERROR;
	const isBridgeWorking = payoutStatus === BridgePayoutStatus.UNPROCESSED;
	const isPayoutFailed = payoutStatus === BridgePayoutStatus.FAILED;
	const isPayoutSent = payoutStatus === BridgePayoutStatus.SENT;
	const isPayoutConfirmed = payoutStatus === BridgePayoutStatus.COMPLETED;

	const requestTimestampText = requestTimestamp
		? formatDate(requestTimestamp, $t, true)
		: '';
	const payoutTimestampText = payoutTimestamp
		? formatDate(payoutTimestamp, $t, true)
		: '';

	return [
		{
			title: $t('s_bridge_swapStatus_step_requestSend'),
			icon: 'send-plane',
			status: ActivityStatus.COMPLETE,
			caption: requestTimestampText
		},
		{
			title: $t('s_bridge_swapStatus_step_awaitingBridge'),
			icon: 'pending',
			status: isBridgeWorking || isPayoutFailed || isPayoutSent || isPayoutConfirmed
				? ActivityStatus.COMPLETE
				: isRequestConfirmed
					? ActivityStatus.LOADING
					: isRequestFailed
						? ActivityStatus.ERROR
						: ActivityStatus.PENDING,
			caption: isRequestFailed ? errorMessage : ''
		},
		{
			title: $t('s_bridge_swapStatus_step_payoutSend'),
			icon: 'swap',
			status: isPayoutFailed 
				? ActivityStatus.ERROR
				: isPayoutSent || isPayoutConfirmed
					? ActivityStatus.COMPLETE
					: isBridgeWorking
						? ActivityStatus.LOADING
						: ActivityStatus.PENDING,
			caption: isPayoutFailed ? errorMessage : ''
		},
		{
			title: $t('s_bridge_swapStatus_step_payoutConfirmation'),
			icon: 'check',
			status: isPayoutConfirmed 
				? ActivityStatus.COMPLETE 
				: isPayoutSent
					? ActivityStatus.LOADING
					: ActivityStatus.PENDING,
			caption: payoutTimestampText
		}
	];
};
