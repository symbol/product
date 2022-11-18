import { networkIdentifierToNetworkType } from './network';
import { Account } from 'symbol-sdk';

export const addressFromPrivateKey = (privateKey, networkIdentifier) => {
    const networkType = networkIdentifierToNetworkType(networkIdentifier);

    return Account.createFromPrivateKey(privateKey, networkType).address.plain();
};

export const createWalletAccount = (privateKey, networkIdentifier, name, accountType, index) => {
    return {
        address: addressFromPrivateKey(privateKey, networkIdentifier),
        name,
        privateKey,
        networkIdentifier,
        accountType,
        index: (index === null || index === undefined) ? null : index
    }
};

export const isPublicOrPrivateKey = stringToTest => {
    return typeof stringToTest === 'string' && stringToTest.length === 64;
}
