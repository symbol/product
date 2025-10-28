import { ethers } from 'ethers';

const BASE_PATH = 'm/44\'/60\'/0\'/0';

/**
 * Generates a random Ethereum mnemonic phrase.
 * @returns {string} The generated mnemonic phrase.
 */
export const generateMnemonic = () => {
	const entropy = ethers.randomBytes(32);
	const mnemonic = ethers.Mnemonic.fromEntropy(entropy);

	return mnemonic.phrase;
};

/**
 * Creates an array of Ethereum private keys from a given mnemonic phrase.
 * Derives using BIP44 path: m/44'/60'/0'/0/index
 * @param {string} mnemonic - The mnemonic phrase used to generate the private keys.
 * @param {number[]} indexes - An array of indexes to derive the private keys from.
 * @returns {string[]} An array of private keys derived from the mnemonic and indexes.
 */
export const createPrivateKeysFromMnemonic = (mnemonic, indexes) => {
	return indexes.map(index => {
		const path = `${BASE_PATH}/${index}`;
		const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, path);
		
		return wallet.privateKey;
	});
};
