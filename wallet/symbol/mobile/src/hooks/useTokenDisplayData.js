import { useWalletController } from './useWalletController';
import { getTokenKnownInfo } from '@/app/utils';
import { useMemo } from 'react';

/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/Token').Token} Token */
/** @typedef {import('@/app/types/Token').TokenDisplayData} TokenDisplayData */

/**
 * React hook that resolves display data (name, ticker, known image) for one token or a list of
 * tokens on the current network, memoized per input. Name and ticker are returned separately;
 * the display label is composed by the rows.
 * @param {Token|Token[]} tokenOrTokens - A single token or a list of tokens to resolve.
 * @param {ChainName} [chainName] - The chain to resolve against. Defaults to the main chain.
 * @returns {TokenDisplayData|TokenDisplayData[]} Display data matching the input shape.
 */
export const useTokenDisplayData = (tokenOrTokens, chainName) => {
	const walletController = useWalletController(chainName);
	const { chainName: resolvedChainName, networkIdentifier } = walletController;
	const isArrayInput = Array.isArray(tokenOrTokens);
	const tokens = isArrayInput ? tokenOrTokens : [tokenOrTokens];
	// Memoize on the list content, as callers may build it inline
	const tokensKey = tokens.map(token => `${token.id}:${token.amount}`).join();

	const displayDataList = useMemo(
		() => tokens.map(token => {
			const knownInfo = getTokenKnownInfo(resolvedChainName, networkIdentifier, token.id);

			return {
				tokenId: token.id,
				amount: token.amount,
				name: knownInfo.name ?? token.name ?? token.id,
				ticker: knownInfo.ticker,
				imageId: knownInfo.imageId
			};
		}),
		[tokensKey, resolvedChainName, networkIdentifier]
	);

	return isArrayInput ? displayDataList : displayDataList[0];
};
