import { NetworkType } from 'symbol-sdk';

export const networkTypeToIdentifier = (networkType) => {
    if (networkType === NetworkType.MAIN_NET)
        return 'mainnet';
    if (networkType === NetworkType.TEST_NET)
        return 'testnet';
    return 'custom';
}

export const networkIdentifierToNetworkType = (networkIdentifier) => {
    if (networkIdentifier === 'mainnet')
        return NetworkType.MAIN_NET;
    if (networkIdentifier === 'testnet')
        return NetworkType.TEST_NET;
    return 0;
}
