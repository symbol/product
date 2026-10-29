/** @typedef {import('@/app/types/ColorVariants').IconColorVariants} IconColorVariants */

/**
 * Contact list type.
 * @enum {string}
 */
export const ContactListType = {
	WHITELIST: 'whitelist',
	BLACKLIST: 'blacklist'
};

/**
 * AddressBookWidget config.
 * @typedef {object} AddressBookWidgetConfig
 * @property {{ iconVariant: IconColorVariants }} addContactButton - Add contact button settings.
 */

export {};
