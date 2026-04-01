import { $t } from '@/app/localization';
import { BridgePayoutStatus, BridgeRequestStatus } from '@/app/screens/bridge/types/Bridge';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeRequestStatusType} BridgeRequestStatusType */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgePayoutStatusType} BridgePayoutStatusType */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeRequest} BridgeRequest */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapStatusDisplayData} SwapStatusDisplayData */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapStatusCaptionDisplayData} SwapStatusCaptionDisplayData */

const iconNameMap = {
	unprocessed: 'pending',
	processing: 'pending',
	sent: 'send-plane',
	completed: 'check-circle',
	failed: 'alert-danger'
};

const variantMap = {
	unprocessed: 'warning',
	processing: 'warning',
	sent: 'warning',
	completed: 'success',
	failed: 'danger'
};

/**
 * Gets swap status display information based on request and payout status.
 * @param {BridgeRequestStatusType} requestStatus - The request status.
 * @param {BridgePayoutStatusType} [payoutStatus] - The payout status.
 * @returns {SwapStatusDisplayData} Status display information.
 */
export const getSwapStatus = (requestStatus, payoutStatus) => {
	let variant;
	let iconName;
	let text;

	switch (requestStatus) {
	case BridgeRequestStatus.CONFIRMED:
		variant = variantMap.unprocessed;
		iconName = iconNameMap.unprocessed;
		text = $t('s_bridge_history_status_unprocessed');
		break;

	case BridgeRequestStatus.ERROR:
		variant = variantMap.failed;
		iconName = iconNameMap.failed;
		text = $t('s_bridge_history_status_failed');
		break;
	};

	switch (payoutStatus) {
	case BridgePayoutStatus.UNPROCESSED:
		variant = variantMap.processing;
		iconName = iconNameMap.processing;
		text = $t('s_bridge_history_status_processing');
		break;
	case BridgePayoutStatus.SENT:
		variant = variantMap.sent;
		iconName = iconNameMap.sent;
		text = $t('s_bridge_history_status_sent');
		break;
	case BridgePayoutStatus.COMPLETED:
		variant = variantMap.completed;
		iconName = iconNameMap.completed;
		text = $t('s_bridge_history_status_completed');
		break;
	case BridgePayoutStatus.FAILED:
		variant = variantMap.failed;
		iconName = iconNameMap.failed;
		text = $t('s_bridge_history_status_failed');
		break;
	};
    
	return { variant, iconName, text };
};

/**
 * Gets swap status caption display information.
 * @param {BridgeRequest} data - The bridge request data.
 * @returns {SwapStatusCaptionDisplayData} Caption display information.
 */
export const getSwapStatusCaption = data => {
	const { requestStatus, errorMessage } = data;

	let isVisible;
	let text;
	let textStyle;
	let textType;

	switch (requestStatus) {
	case BridgeRequestStatus.CONFIRMED:
		isVisible = true;
		text = $t('s_bridge_history_requestTransactionConfirmed');
		textStyle = 'regular';
		textType = 'body';
		break;
	case BridgeRequestStatus.ERROR:
		isVisible = true;
		text = errorMessage;
		textStyle = 'error';
		textType = 'label';
		break;
	default:
		isVisible = false;
		text = null;
		textStyle = null;
		textType = null;
	}

	return { isVisible, text, textStyle, textType };
};
