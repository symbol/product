import { TransportValidationResult } from '../types/TransportValidation';
import { $t } from '@/app/localization';

/**
 * Alert data for transport URI validation feedback.
 * @typedef {Object} TransportAlertData
 * @property {boolean} isVisible - Whether the alert should be visible.
 * @property {string} [text] - The alert message text.
 * @property {import('@/app/types/ColorVariants').SemanticRoleColorVariants} [variant] - The alert variant.
 */

/**
 * Creates alert data from a parse error or a validation result.
 *
 * @param {Error | null} error - Parse error, or null if parsing succeeded.
 * @param {string | null} validationResult - A {@link TransportValidationResult} value, or null if valid.
 * @param {Object} context - Context required to build alert messages.
 * @param {import('./transport-actions').TransportUriObject | null} context.transportUriObject - The parsed transport URI object.
 * @param {string} context.networkIdentifier - Current network identifier.
 * @returns {TransportAlertData} The alert data.
 */
export const createTransportAlertData = (error, validationResult, { transportUriObject, networkIdentifier }) => {
	if (error) {
		return {
			isVisible: true,
			text: $t('s_transportRequest_alert_parseError_text', { message: error.message }),
			variant: 'danger'
		};
	}

	switch (validationResult) {
	case TransportValidationResult.UNSUPPORTED_CHAIN:
		return {
			isVisible: true,
			text: $t('s_transportRequest_alert_chainNameSupport_text', { chainName: transportUriObject.chainName }),
			variant: 'warning'
		};
	case TransportValidationResult.INACTIVE_CHAIN:
		return {
			isVisible: true,
			text: $t('s_transportRequest_alert_chainNameActive_text', { chainName: transportUriObject.chainName }),
			variant: 'warning'
		};
	case TransportValidationResult.NETWORK_MISMATCH:
		return {
			isVisible: true,
			text: $t('s_transportRequest_alert_networkIdentifierMismatch_text', {
				requestNetwork: transportUriObject.networkIdentifier,
				currentNetwork: networkIdentifier
			}),
			variant: 'warning'
		};
	case TransportValidationResult.CHAIN_ID_MISMATCH:
		return {
			isVisible: true,
			text: $t('s_transportRequest_alert_chainIdMismatch_text'),
			variant: 'warning'
		};
	default:
		return { isVisible: false };
	}
};
