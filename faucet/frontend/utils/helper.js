import { Network as NemNetwork } from 'symbol-sdk/nem';
import { Network as SymbolNetwork } from 'symbol-sdk/symbol';
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';

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
	return NemNetwork.TESTNET.isValidAddressString(address);
};

/**
 * Validates Symbol testnet address
 * @param {string} address address string.
 * @returns {boolean} address validity.
 */
export const validateSymbolAddress = address => {
	return SymbolNetwork.TESTNET.isValidAddressString(address);
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

/**
 * Encrypt value to hex
 * @param {string} value value to encrypt
 * @param {string} secret secret value
 * @returns {string} encrypted hex value
 */
export const encrypt = (value, secret) => {
	const iv = crypto.randomBytes(16);
	const cipher = crypto.createCipheriv(algorithm, Buffer.from(secret, 'hex'), iv);
	let encrypted = cipher.update(value);
	encrypted = Buffer.concat([encrypted, cipher.final()]);

	const tag = cipher.getAuthTag();

	return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
};

/**
 * Decrypt hex to utf8
 * @param {string} encrypted encrypted hex value
 * @param {string} secret secret value
 * @returns {string} decrypted value
 */
export const decrypt = (encrypted, secret) => {
	const textParts = encrypted.split(':');
	const iv = Buffer.from(textParts[0], 'hex');
	const tag = Buffer.from(textParts[1], 'hex');
	const encryptedText = Buffer.from(textParts[2], 'hex');

	const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secret, 'hex'), iv);
	decipher.setAuthTag(tag);

	let decrypted = decipher.update(encryptedText);
	decrypted = Buffer.concat([decrypted, decipher.final()]);

	return decrypted.toString('utf8');
};
