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

export const makeRequest = async (url, options) => {
    const response = await fetch(url, options);
    console.log('FETCH', url)

    if (response.status === 404) {
        // noerror
        throw Error('error_fetch_not_found');
    }

    if (response.status === 429) {
        // noerror
        throw Error('error_fetch_rate_limit');
    }

    if (response.status === 500) {
        // noerror
        throw Error('error_fetch_server_error');
    }

    if (response.status === 502) {
        // noerror
        throw Error('error_fetch_server_error');
    }

    return response.json();
}
