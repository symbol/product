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

export const isSymbolAddress = address => {
    if (typeof address !== 'string') {
        return false;
    } 
    if (address.length !== 39) {
        return false;
    }
    const addressTrimAndUpperCase = address.trim().toUpperCase().replace(/-/g, '');
    
    if (addressTrimAndUpperCase.charAt(0) !== 'T' && addressTrimAndUpperCase.charAt(0) !== 'N') {
        return false;
    }

    return true;
}
