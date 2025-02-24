import { SymbolPaperWallet } from 'symbol-wallets-lib';
import { Buffer } from 'buffer';
import { networkIdentifierToNetworkType } from './network';
import { optInWhiteList } from '@/app/config';
import { createWalletStorageAccount, publicAccountFromPrivateKey } from './account';
import { Bip32 } from 'symbol-sdk';
import { SymbolFacade } from 'symbol-sdk/symbol';
import { DEFAULT_ACCOUNT_NAME, MAX_SEED_ACCOUNTS_PER_NETWORK, NetworkIdentifier, WalletAccountType } from '@/app/constants';
import { createNetworkMap } from '@/app/utils/network';
import * as AccountTypes from '@/app/types/Account'; // eslint-disable-line no-unused-vars

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
 * @param {string} mnemonic - The mnemonic phrase used to generate the private keys.
 * @param {number[]} indexes - An array of indexes to derive the private keys from.
 * @param {string} networkIdentifier - The network identifier for the Symbol blockchain.
 * @param {boolean} isOptInCurve - A flag indicating whether to use the opt-in curve (secp256k1) or the Symbol curve.
 * @returns {string[]} An array of private keys derived from the mnemonic and indexes.
 */
export const createPrivateKeysFromMnemonic = (mnemonic, indexes, networkIdentifier, isOptInCurve) => {
    const facade = new SymbolFacade(networkIdentifier);
    const symbolCurve = facade.static.BIP32_CURVE_NAME;
    const optInCurve = 'secp256k1';
    const curve = isOptInCurve ? optInCurve : symbolCurve;
    const bip = new Bip32(curve);
    const rootNode = bip.fromMnemonic(mnemonic, '');

    const privateKeys = indexes.map((index) => {
        const path = facade.bip32Path(index);
        const childNode = rootNode.derivePath(path);
        const childKeyPair = facade.constructor.bip32NodeToKeyPair(childNode);

        return childKeyPair.privateKey.toString();
    });

    return privateKeys;
};

/**
 * Creates a paper wallet PDF in base64 format.
 * @param {string} mnemonic - The mnemonic phrase for the wallet.
 * @param {Object} rootAccount - The root account object.
 * @param {string} rootAccount.publicKey - The public key of the root account.
 * @param {string} rootAccount.address - The address of the root account.
 * @param {string} networkIdentifier - The network identifier.
 * @returns {Promise<string>} A promise that resolves to the base64 encoded paper wallet PDF.
 */
export const createPaperWallet = async (mnemonic, rootAccount, networkIdentifier) => {
    const hdRootAccount = {
        mnemonic: mnemonic,
        rootAccountPublicKey: rootAccount.publicKey,
        rootAccountAddress: rootAccount.address,
    };

    const paperWallet = new SymbolPaperWallet(hdRootAccount, [], networkIdentifierToNetworkType(networkIdentifier));

    const paperWalletPdf = await paperWallet.toPdf();
    const paperWalletBase64 = Buffer.from(paperWalletPdf).toString('base64');

    return paperWalletBase64;
};

/**
 * Creates an opt-in private key from a mnemonic phrase.
 * @param {string} mnemonic - The mnemonic phrase used to generate the private key.
 * @returns {string|null} The opt-in private key if it is whitelisted, otherwise null.
 */
export const createOptInPrivateKeyFromMnemonic = (mnemonic) => {
    const [optInPrivateKey] = createPrivateKeysFromMnemonic(mnemonic.trim(), [0], NetworkIdentifier.MAIN_NET, 'optin');
    const optInAccount = publicAccountFromPrivateKey(optInPrivateKey, NetworkIdentifier.MAIN_NET);
    const isKeyWhitelisted = optInWhiteList.some((publicKey) => publicKey === optInAccount.publicKey);

    return isKeyWhitelisted ? optInPrivateKey : null;
};

/**
 * Generates seed accounts based on the provided mnemonic.
 * @param {string} mnemonic - The mnemonic phrase used to generate the seed accounts.
 * @returns {Promise<Object.<string, AccountTypes.WalletStorageAccount>} A promise that resolves to a network map containing the generated seed accounts.
 */
export const generateSeedAccounts = async (mnemonic) => {
    const seedIndexes = [...Array(MAX_SEED_ACCOUNTS_PER_NETWORK).keys()];

    return createNetworkMap((networkIdentifier) =>
        createPrivateKeysFromMnemonic(mnemonic, seedIndexes, networkIdentifier).map((privateKey, index) =>
            createWalletStorageAccount(privateKey, networkIdentifier, `${DEFAULT_ACCOUNT_NAME} ${index + 1}`, WalletAccountType.SEED, index)
        )
    );
};
