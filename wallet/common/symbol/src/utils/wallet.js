import { NetworkIdentifier } from '../constants';
import { Bip32 } from 'symbol-sdk';
import { SymbolFacade } from 'symbol-sdk/symbol';

const OPT_IN_CURVE = 'secp256k1';

/**
 * Generates a random mnemonic phrase.
 * @returns {string} The generated mnemonic phrase.
 */
export const generateMnemonic = () => {
	const bip = new Bip32();
	const mnemonic = bip.random();

	return mnemonic.toString();
};

/**
 * Creates an array of private keys from a given mnemonic phrase.
 * ```js
 * const mnemonic = '...';
 * const indexes = [0, 1, 2, 3, 4];
 * const networkIdentifier = 'mainnet';
 * const privateKeys = createPrivateKeysFromMnemonic(mnemonic, indexes, networkIdentifier);
 * ```
 * @param {string} mnemonic - The mnemonic phrase used to generate the private keys.
 * @param {number[]} indexes - An array of indexes to derive the private keys from.
 * @param {string} networkIdentifier - The network identifier for the Symbol blockchain.
 * @param {boolean} [curve] - The curve used to derive the private keys. Default is "ed25519".
 * @returns {string[]} An array of private keys derived from the mnemonic and indexes.
 */
export const createPrivateKeysFromMnemonic = (mnemonic, indexes, networkIdentifier, curve = SymbolFacade.BIP32_CURVE_NAME) => {
	const facade = new SymbolFacade(networkIdentifier);
	const bip = new Bip32(curve);
	const rootNode = bip.fromMnemonic(mnemonic, '');

	const privateKeys = indexes.map(index => {
		const path = facade.bip32Path(index);
		const childNode = rootNode.derivePath(path);
		const childKeyPair = facade.constructor.bip32NodeToKeyPair(childNode);

		return childKeyPair.privateKey.toString();
	});

	return privateKeys;
};

/**
 * Creates an opt-in private key from a mnemonic phrase.
 * @param {string} mnemonic - The mnemonic phrase used to generate the private key.
 * @returns {string|null} The opt-in private key if it is whitelisted, otherwise null.
 */
export const createOptInPrivateKeyFromMnemonic = mnemonic => {
	const [optInPrivateKey] = createPrivateKeysFromMnemonic(mnemonic.trim(), [0], NetworkIdentifier.MAIN_NET, OPT_IN_CURVE);

	return optInPrivateKey;
};
