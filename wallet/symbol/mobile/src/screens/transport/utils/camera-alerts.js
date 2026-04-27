import { $t } from '@/app/localization';

/**
 * Alert data for camera status feedback.
 * @typedef {Object} CameraAlertData
 * @property {boolean} isVisible - Whether the alert should be visible.
 * @property {string} text - The alert message text.
 * @property {import('@/app/types/ColorVariants').SemanticRoleColorVariants} variant - The alert variant.
 */

/**
 * Creates alert data for camera status feedback.
 * Permission is checked first, then device availability.
 * @param {boolean} hasPermission - Whether camera permission has been granted.
 * @param {object|null} device - The camera device object, or null if unavailable.
 * @returns {CameraAlertData} The alert data.
 */
export const createCameraAlertData = (hasPermission, device) => {
	if (!hasPermission) {
		return {
			isVisible: true,
			text: $t('s_scan_alert_noPermission_text'),
			variant: 'warning'
		};
	}

	if (device == null) {
		return {
			isVisible: true,
			text: $t('s_scan_alert_noDevice_text'),
			variant: 'warning'
		};
	}

	return {
		isVisible: false
	};
};
