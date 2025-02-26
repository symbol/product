import { PrivateKey, PublicKey } from 'symbol-sdk';
import { Address, SymbolFacade } from 'symbol-sdk/symbol';
import * as AccountTypes from '@/app/types/Account';

/**
 * Generates a key pair consisting of a private key and a public key.
 * @returns {AccountTypes.KeyPair} An object containing the generated private key and public key.
 */
export const generateKeyPair = () => {
    const privateKey = PrivateKey.random();
    const keyPair = new SymbolFacade.KeyPair(privateKey);

    return {
        privateKey: privateKey.toString(),
        publicKey: keyPair.publicKey.toString(),
    };
};

/**
 * Get the account address from a given private key.
 * @param {string} privateKey - The private key.
 * @param {string} networkIdentifier - The network identifier.
 * @returns {string} The account address.
 */
export const addressFromPrivateKey = (privateKey, networkIdentifier) => {
    return publicAccountFromPrivateKey(privateKey, networkIdentifier).address;
};

/**
 * Get the account address from a given public key.
 * @param {string} publicKey - The public key.
 * @param {string} networkIdentifier - The network identifier.
 * @returns {string} The account address.
 */
export const addressFromPublicKey = (publicKey, networkIdentifier) => {
    return publicAccountFromPublicKey(publicKey, networkIdentifier).address;
};

/**
 * Creates the public account from a given public key.
 * @param {string} publicKey - The public key.
 * @param {string} networkIdentifier - The network identifier.
 * @returns {AccountTypes.PublicAccount} The public account.
 */
export const publicAccountFromPublicKey = (publicKey, networkIdentifier) => {
    const facade = new SymbolFacade(networkIdentifier);
    const _publicKey = new PublicKey(publicKey);
    const address = facade.network.publicKeyToAddress(_publicKey);

    return {
        address: address.toString(),
        publicKey,
        networkIdentifier,
    };
};

/**
 * Creates the public account from a given private key.
 * @param {string} privateKey - The private key.
 * @param {string} networkIdentifier - The network identifier.
 * @returns {AccountTypes.PublicAccount} The public account.
 */
export const publicAccountFromPrivateKey = (privateKey, networkIdentifier) => {
    const facade = new SymbolFacade(networkIdentifier);
    const _privateKey = new PrivateKey(privateKey);
    const keyPair = new SymbolFacade.KeyPair(_privateKey);
    const address = facade.network.publicKeyToAddress(keyPair.publicKey);

    return {
        address: address.toString(),
        publicKey: keyPair.publicKey.toString(),
        networkIdentifier,
    };
};

/**
 * Creates a wallet account object.
 * @param {string} privateKey - The private key.
 * @param {string} networkIdentifier - The network identifier.
 * @param {string} name - The account name.
 * @param {string} accountType - The account type.
 * @param {number} [index] - The account index.
 * @returns {AccountTypes.WalletAccount} The wallet account object.
 */
export const createWalletAccount = (privateKey, networkIdentifier, name, accountType, index) => {
    const publicAccount = publicAccountFromPrivateKey(privateKey, networkIdentifier);

    return {
        address: publicAccount.address,
        publicKey: publicAccount.publicKey,
        name,
        networkIdentifier,
        accountType,
        index: index === null || index === undefined ? null : index,
    };
};

/**
 * Creates a wallet storage account object. This object includes the private key.
 * @param {string} privateKey - The private key.
 * @param {string} networkIdentifier - The network identifier.
 * @param {string} name - The account name.
 * @param {string} accountType - The account type.
 * @param {number} [index] - The account index.
 * @returns {AccountTypes.WalletStorageAccount} The wallet storage account object.
 */
export const createWalletStorageAccount = (privateKey, networkIdentifier, name, accountType, index) => {
    return {
        ...createWalletAccount(privateKey, networkIdentifier, name, accountType, index),
        privateKey,
    };
};

/**
 * Checks if a given string is a valid private key.
 * @param {string} stringToTest - The string to test.
 * @returns {boolean} A boolean indicating if the string is a valid private key.
 */
export const isPublicOrPrivateKey = (stringToTest) => {
    return typeof stringToTest === 'string' && stringToTest.length === 64;
};

/**
 * Checks if a given string is a valid Symbol address.
 * @param {string} address - The address to test.
 * @returns {boolean} A boolean indicating if the string is a valid Symbol address.
 */
export const isSymbolAddress = (address) => {
    if (typeof address !== 'string') {
        return false;
    }

    const addressTrimAndUpperCase = address.trim().toUpperCase().replace(/-/g, '');

    if (addressTrimAndUpperCase.length !== 39) {
        return false;
    }

    if (addressTrimAndUpperCase.charAt(0) !== 'T' && addressTrimAndUpperCase.charAt(0) !== 'N') {
        return false;
    }

    return true;
};

/**
 * Converts a raw address to a Symbol address.
 * @param {string} rawAddress - The raw address.
 * @returns {string} The Symbol address.
 */
export const addressFromRaw = (rawAddress) => {
    return new Address(Buffer.from(rawAddress, 'hex')).toString();
};
