import { cacheEntries } from './config';
import { makeRequest } from '@/app/utils';
import { RequestCache } from 'wallet-common-core';

export const requestCache = new RequestCache(cacheEntries);

// Drop-in replacement for makeRequest used by the api composition roots.
export const cachedMakeRequest = requestCache.wrap(makeRequest);
