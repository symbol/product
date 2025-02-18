import { NetworkIdentifier, NetworkType } from '@/app/constants';
import { config } from '@/app/config';

export const networkTypeToIdentifier = (networkType) => {
    if (networkType === NetworkType.MAIN_NET) return NetworkIdentifier.MAIN_NET;
    if (networkType === NetworkType.TEST_NET) return NetworkIdentifier.TEST_NET;
    return 'custom';
};

export const networkIdentifierToNetworkType = (networkIdentifier) => {
    if (networkIdentifier === NetworkIdentifier.MAIN_NET) return NetworkType.MAIN_NET;
    if (networkIdentifier === NetworkIdentifier.TEST_NET) return NetworkType.TEST_NET;
    return 0;
};

export const makeRequest = async (url, options) => {
    const response = await fetch(url, options);

    if (response.status === 400 || response.status === 409) {
        throw Error('error_fetch_invalid_request');
    }

    if (response.status === 404) {
        throw Error('error_fetch_not_found');
    }

    if (response.status === 429) {
        throw Error('error_fetch_rate_limit');
    }

    if (response.status === 500) {
        throw Error('error_fetch_server_error');
    }

    if (response.status === 502) {
        throw Error('error_fetch_server_error');
    }

    return response.json();
};

export const createNetworkMap = (callback) => {
    const networkIdentifiers = [...config.networkIdentifiers];
    const maps = networkIdentifiers.map((networkIdentifier) => [networkIdentifier, callback(networkIdentifier)]);

    return Object.fromEntries(maps);
};
