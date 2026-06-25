import { Bip32 } from 'symbol-sdk';
import { NemFacade } from 'symbol-sdk/nem';

/**
 * Generates a random BIP39 mnemonic phrase.
 * @returns {string} The generated mnemonic phrase.
 */
export const generateMnemonic = () => {
	const bip = new Bip32();

	return bip.random().toString();
};

/**
 * Creates an array of private keys from a mnemonic phrase using NEM BIP32 derivation.
 * @param {string} mnemonic - The mnemonic phrase used to generate the private keys.
 * @param {number[]} indexes - An array of indexes to derive the private keys from.
 * @param {string} networkIdentifier - The network identifier for the NEM blockchain.
 * @param {string} [curve] - The curve name used to derive the private keys. Defaults to NemFacade.BIP32_CURVE_NAME.
 * @returns {string[]} An array of private keys derived from the mnemonic and indexes.
 */
export const createPrivateKeysFromMnemonic = (
	mnemonic,
	indexes,
	networkIdentifier,
	curve = NemFacade.BIP32_CURVE_NAME
) => {
	const facade = new NemFacade(networkIdentifier);
	const bip = new Bip32(curve);
	const rootNode = bip.fromMnemonic(mnemonic, '');

	return indexes.map(index => {
		const path = facade.bip32Path(index);
		const childNode = rootNode.derivePath(path);
		const childKeyPair = NemFacade.bip32NodeToKeyPair(childNode);

		return childKeyPair.privateKey.toString();
	});
};
