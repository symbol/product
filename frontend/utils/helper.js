import symbolSDK from 'symbol-sdk';

const { nem, symbol } = symbolSDK;

/**
 * Converts absolute amount to relative.
 * @param {number} value absolute amount.
 * @param {number} divisibility divisibility.
 * @returns {number} relative amount.
 */
export const absoluteToRelativeAmount = (value, divisibility) => value / (10 ** divisibility);

/**
 * Converts relative amount to absolute.
 * @param {number} value relative amount.
 * @param {number} divisibility divisibility.
 * @returns {number} absolute amount.
 */
export const relativeToAbsoluteAmount = (value, divisibility) => value * (10 ** divisibility);

/**
 * Validates NEM testnet address
 * @param {string} address address string.
 * @returns {boolean} address validity.
 */
export const validateNEMAddress = address => {
	return nem.Network.TESTNET.isValidAddressString(address);
};

/**
 * Validates Symbol testnet address
 * @param {string} address address string.
 * @returns {boolean} address validity.
 */
export const validateSymbolAddress = address => {
	return symbol.Network.TESTNET.isValidAddressString(address);
};

/**
 * Creates i18n translation function which returns localized text string by key
 * @param {object.<string, object.<string, string>>} locales localization config.
 * @returns {function} i18n translation function.
 */
export const createI18n = locales => (key, params) => {
	const currentLanguage = localStorage.getItem('currentLanguage');
	const locale = locales[currentLanguage] || Object.values(locales)[0];
	const keyExists = locale.hasOwnProperty(key);

	if (!keyExists)
		return `[missing_translation]${key}`;

	let translatedString = `${locale[key]}`;
	params && Object.keys(params).forEach(variableName => {
		translatedString = translatedString.replace(new RegExp(`%${variableName}`, 'g'), params[variableName]);
	});

	return translatedString;
};
