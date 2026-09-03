import { getTokenKnownInfo } from '@/app/utils';

/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Token').TokenInfo} TokenInfo */

/**
 * Resolves the units text of a swap summary amount: the token's ticker from the known-tokens
 * configuration, or the token name when the token is not listed there.
 * @param {TokenInfo} token - The token to resolve.
 * @param {ChainName} chainName - The token's blockchain name.
 * @param {NetworkIdentifier} networkIdentifier - The network identifier.
 * @returns {string} Ticker text.
 */
export const getTokenTickerText = (token, chainName, networkIdentifier) =>
	getTokenKnownInfo(chainName, networkIdentifier, token.id).ticker ?? token.name;
