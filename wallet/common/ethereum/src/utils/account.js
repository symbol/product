import { SigningKey, Wallet, computeAddress, isAddress } from 'ethers';

/** @typedef {import('../types/Account').KeyPair} KeyPair */
/** @typedef {import('../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../types/Account').PrivateAccount} PrivateAccount */
/** @typedef {import('../types/Account').WalletAccount} WalletAccount */

const to0x = hex => (typeof hex === 'string' && hex.startsWith('0x') ? hex : `0x${hex}`);

/**
 * Generates an Ethereum key pair consisting of a private key and a public key.
 * @returns {KeyPair} An object containing the generated private key and public key.
 */
export const generateKeyPair = () => {
	const wallet = Wallet.createRandom();

	return {
		privateKey: wallet.privateKey,
		publicKey: wallet.publicKey
	};
};

/**
 * Get the Ethereum account address from a given private key.
 * @param {string} privateKey - The private key.
 * @returns {string} The account address.
 */
export const addressFromPrivateKey = privateKey => {
	return computeAddress(to0x(privateKey));
};

/**
 * Get the Ethereum account address from a given public key.
 * @param {string} publicKey - The public key.
 * @returns {string} The account address.
 */
export const addressFromPublicKey = publicKey => {
	return computeAddress(to0x(publicKey));
};

/**
 * Creates the public account from a given public key.
 * @param {string} publicKey - The public key.
 * @param {string} networkIdentifier - The network identifier.
 * @param {string} [accountType] - The account type (optional).
 * @param {number} [index] - The account index (optional).
 * @returns {PublicAccount} The public account.
 */
export const publicAccountFromPublicKey = (publicKey, networkIdentifier, accountType, index) => {
	const address = computeAddress(to0x(publicKey));

	const account = {
		address,
		publicKey,
		networkIdentifier
	};

	if (index !== null && index !== undefined)
		account.index = index;

	if (accountType)
		account.accountType = accountType;

	return account;
};

/**
 * Creates the public account from a given private key.
 * @param {string} privateKey - The private key.
 * @param {string} networkIdentifier - The network identifier.
 * @param {string} [accountType] - The account type (optional).
 * @param {number} [index] - The account index (optional).
 * @returns {PublicAccount} The public account.
 */
export const publicAccountFromPrivateKey = (privateKey, networkIdentifier, accountType, index) => {
	const sk = new SigningKey(to0x(privateKey));
	const {publicKey} = sk;

	return publicAccountFromPublicKey(publicKey, networkIdentifier, accountType, index);
};

/**
 * Creates a wallet storage account object. This object includes the private key.
 * @param {string} privateKey - The private key.
 * @param {string} networkIdentifier - The network identifier.
 * @param {string} [accountType] - The account type (optional).
 * @param {number} [index] - The account index (optional).
 * @returns {PrivateAccount} The wallet storage account object.
 */
export const createPrivateAccount = (privateKey, networkIdentifier, accountType, index) => {
	const publicAccount = publicAccountFromPrivateKey(privateKey, networkIdentifier, accountType, index);

	return {
		...publicAccount,
		privateKey
	};
};

/**
 * Creates a wallet account object.
 * @param {string} privateKey - The private key.
 * @param {string} networkIdentifier - The network identifier.
 * @param {string} name - The account name.
 * @param {string} accountType - The account type.
 * @param {number} [index] - The account index.
 * @returns {WalletAccount} The wallet account object.
 */
export const createWalletAccount = (privateKey, networkIdentifier, name, accountType, index) => {
	const publicAccount = publicAccountFromPrivateKey(privateKey, networkIdentifier, accountType, index);

	return {
		...publicAccount,
		name,
		accountType
	};
};

/**
 * Checks if a given string looks like an Ethereum private key.
 * Accepts:
 * - private key: 32 bytes (64 hex, with or without 0x)
 * @param {string} stringToTest - The string to test.
 * @returns {boolean} A boolean indicating if the string is a valid-looking key.
 */
export const isPrivateKey = stringToTest => {
	if (typeof stringToTest !== 'string') 
		return false;

	const hex = stringToTest.startsWith('0x') ? stringToTest.slice(2) : stringToTest;
	
	if (!/^[0-9a-fA-F]+$/.test(hex)) 
		return false;

	const privateKeyLength = 32 * 2;
	const acceptedLength = [
		privateKeyLength
	];

	return acceptedLength.includes(hex.length);
};

/**
 * Checks if a given string looks like an Ethereum public key.
 * Accepts:
 * - public key (compressed): 33 bytes (66 hex)
 * - public key (uncompressed): 65 bytes (130 hex)
 * @param {string} stringToTest - The string to test.
 * @returns {boolean} A boolean indicating if the string is a valid-looking key.
 */
export const isPublicKey = stringToTest => {
	if (typeof stringToTest !== 'string') 
		return false;

	const hex = stringToTest.startsWith('0x') ? stringToTest.slice(2) : stringToTest;
	
	if (!/^[0-9a-fA-F]+$/.test(hex)) 
		return false;

	const publicKeyCompressedLength = 33 * 2;
	const publicKeyUncompressedLength = 65 * 2;
	const acceptedLength = [
		publicKeyCompressedLength,
		publicKeyUncompressedLength
	];

	return acceptedLength.includes(hex.length);
};

/**
 * Checks if a given string is a valid Ethereum address (with or without checksum).
 * @param {string} address - The address to test.
 * @returns {boolean} A boolean indicating if the string is a valid Ethereum address.
 */
export const isEthereumAddress = address => {
	return typeof address === 'string' && isAddress(address);
};
