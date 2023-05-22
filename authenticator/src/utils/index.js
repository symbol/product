const { config } = require('../config');
const { TwitterApi } = require('twitter-api-v2');
const crypto = require('crypto');

const algorithm = 'aes-256-gcm';

/**
 * Create twitter api client
 * @param {{appKey: string, appSecret: string, accessToken: string, accessSecret: string}} customConfig twitter API credentials
 * @returns {TwitterApi} twitter API
 */
const createTwitterClient = customConfig => new TwitterApi({
	appKey: config.twitterAppKey,
	appSecret: config.twitterAppSecret,
	...customConfig
});

/**
 * Encrypt value to hex
 * @param {string} value value to encrypt
 * @returns {string} encrypted hex value
 */
const encrypt = value => {
	const iv = crypto.randomBytes(16);
	const cipher = crypto.createCipheriv(algorithm, Buffer.from(config.aesSecret, 'hex'), iv);
	let encrypted = cipher.update(value);
	encrypted = Buffer.concat([encrypted, cipher.final()]);

	const tag = cipher.getAuthTag();

	return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
};

/**
 * Decrypt hex to utf8
 * @param {string} encrypted encrypted hex value
 * @returns {string} decrypted value
 */
const decrypt = encrypted => {
	const textParts = encrypted.split(':');
	const iv = Buffer.from(textParts[0], 'hex');
	const tag = Buffer.from(textParts[1], 'hex');
	const encryptedText = Buffer.from(textParts[2], 'hex');

	const decipher = crypto.createDecipheriv(algorithm, Buffer.from(config.aesSecret, 'hex'), iv);
	decipher.setAuthTag(tag);

	let decrypted = decipher.update(encryptedText);
	decrypted = Buffer.concat([decrypted, decipher.final()]);

	return decrypted.toString('utf8');
};

module.exports = { createTwitterClient, encrypt, decrypt };
