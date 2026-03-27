import { $t } from '@/app/localization';
import { ContactListType } from '@/app/screens/address-book/types/AddressBook';

/**
 * Alert data for contact list type feedback.
 * @typedef {Object} ContactListTypeAlertData
 * @property {boolean} isVisible - Whether the alert should be visible.
 * @property {string} text - The alert message text.
 * @property {'success'|'danger'} variant - The alert variant.
 */

/**
 * Creates alert data for contact list type selection.
 * @param {string} listType - The selected list type (whitelist or blacklist).
 * @returns {ContactListTypeAlertData} The alert data.
 */
export const createContactListTypeAlertData = listType => {
	if (listType === ContactListType.WHITELIST) {
		return {
			isVisible: true,
			text: $t('s_addressBook_manageContact_alert_whitelist'),
			variant: 'success'
		};
	}

	return {
		isVisible: true,
		text: $t('s_addressBook_manageContact_alert_blacklist'),
		variant: 'danger'
	};
};

/**
 * Creates alert data for blacklisted contact in contact details.
 * @param {boolean} isBlackListed - Whether the contact is blacklisted.
 * @returns {ContactListTypeAlertData} The alert data.
 */
export const createBlacklistAlertData = isBlackListed => {
	if (!isBlackListed) {
		return {
			isVisible: false
		};
	}

	return {
		isVisible: true,
		text: $t('s_addressBook_contactDetails_alert_blacklist'),
		variant: 'danger'
	};
};
