import { knownTokens } from '@/app/config';
import { safeOperationWithRelativeAmounts } from 'wallet-common-core';

/** @typedef {import('@/app/types/Token').Token} Token */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */

/**
 * Retrieves the known token entry from the known tokens configuration.
 * 
 * @param {string} chainName - The name of the blockchain (e.g., 'symbol', 'ethereum').
 * @param {string} networkIdentifier - The network identifier (e.g., 'mainnet', 'testnet').
 * @param {string} tokenId - The token ID to look up.
 * 
 * @returns {object|null} The known token entry if found, otherwise null.
 */
export const getTokenKnownInfo = (chainName, networkIdentifier, tokenId) => {
	const knownTokenEntry = knownTokens[chainName][networkIdentifier]
		.find(token => token.tokenId === tokenId);

	return {
		name: knownTokenEntry ? knownTokenEntry.name : null,
		ticker: knownTokenEntry ? knownTokenEntry.ticker : null,
		imageId: knownTokenEntry ? knownTokenEntry.imageId : null
	};
};

/**
 * Calculates the total fee amount for a transaction based on the provided transaction fee tiers and selected speed.
 * 
 * @param {import('wallet-common-core/src/types/Transaction').TransactionFeeTiers[]} transactionFeeTiers - Array of transaction fee tiers.
 * @param {import('wallet-common-core/src/types/Transaction').TransactionFeeTierLevel} speed
 * - The selected transaction speed (e.g., 'slow', 'average', 'fast').
 * 
 * @returns {string} The total fee amount as a string.
 */
export const getTotalFeeAmount = (transactionFeeTiers, speed) => {
	const { divisibility } = transactionFeeTiers[0][speed].token;

	return safeOperationWithRelativeAmounts(
		divisibility,
		transactionFeeTiers.map(feeTier => feeTier[speed].token.amount),
		(...args) => args.reduce((a, b) => a + b, 0n)
	);
};

/**
 * Calculates the available balance for a token after accounting for transaction fees.
 * 
 * @param {import('wallet-common-core/src/types/Token').Token} token - The token with amount (balance).
 * @param {string} nativeTokenId - The native currency token ID of the blockchain.
 * @param {import('wallet-common-core/src/types/Transaction').TransactionFeeTiers[]} transactionFeeTiers - Array of transaction fee tiers.
 * @param {import('wallet-common-core/src/types/Transaction').TransactionFeeTierLevel} speed - The selected transaction speed.
 * 
 * @returns {string} The available balance as a string.
 */
export const getAvailableBalance = (token, nativeTokenId, transactionFeeTiers, speed) => {
	const isNativeCurrencyToken = token.id === nativeTokenId;
	const tokenTotalBalance = token.amount || '0';

	// For non-native token do not need to deduct fees
	if (!isNativeCurrencyToken)
		return tokenTotalBalance;

	const divisibility = token.divisibility || 0;
	const totalFee = getTotalFeeAmount(transactionFeeTiers, speed);

	return safeOperationWithRelativeAmounts(
		divisibility,
		[tokenTotalBalance, totalFee],
		(a, b) => a - b
	);
};

/**
 * Token display data structure.
 * @typedef {Object} TokenDisplayData
 * @property {string} name - The display name of the token, potentially including ticker.
 * @property {string|null} ticker - The token's ticker symbol, if available.
 * @property {string|null} imageId - The known image identifier for the token, if available.
 */

/**
 * Creates token display data by combining token information with known token metadata.
 * 
 * @param {Token} token - The token for which to create display data.
 * @param {string} chainName - The name of the blockchain (e.g., 'symbol', 'ethereum').
 * @param {NetworkIdentifier} networkIdentifier - The network identifier (e.g., 'mainnet', 'testnet').
 * 
 * @returns {TokenDisplayData} The token display data.
 */
export const createTokenDisplayData = (token, chainName, networkIdentifier) => {
	const tokenKnownInfo = getTokenKnownInfo(
		chainName,
		networkIdentifier,
		token.id
	);

	const name = tokenKnownInfo.name ?? token.name ?? token.id;
	const { ticker, imageId } = tokenKnownInfo;

	const nameText = !ticker
		? name
		: `${name} • ${ticker}`;

	return {
		name: nameText,
		ticker,
		imageId
	};
};

/**
 * Checks if the provided list of tokens includes the native currency token.
 * 
 * @param {Token[]} tokens - The list of tokens to check.
 * @param {string} nativeTokenId - The native currency token ID of the blockchain.
 * @returns {boolean} True if the native currency token is present, otherwise false.
 */
export const hasNativeCurrencyToken = (tokens, nativeTokenId) => {
	return tokens.some(token => token.id === nativeTokenId);
};

/**
 * Retrieves the native currency token from the provided list of tokens.
 * 
 * @param {Token[]} tokens - The list of tokens to search through.
 * @param {string} nativeTokenId - The native currency token ID of the blockchain.
 * @returns {Token|null} The native currency token if found, otherwise null.
 */
export const getNativeCurrencyToken = (tokens, nativeTokenId) => {
	return tokens.find(token => token.id === nativeTokenId) ?? null;
};

/**
 * Checks if the provided list of tokens includes any non-native currency tokens.
 * 
 * @param {Token[]} tokens - The list of tokens to check.
 * @param {string} nativeTokenId - The native currency token ID of the blockchain.
 * @returns {boolean} True if at least one non-native currency token is present, otherwise false.
 */
export const hasNonNativeCurrencyTokens = (tokens, nativeTokenId) => {
	return tokens.some(token => token.id !== nativeTokenId);
};

/**
 * Retrieves all non-native currency tokens from the provided list of tokens.
 * 
 * @param {Token[]} tokens - The list of tokens to search through.
 * @param {string} nativeTokenId - The native currency token ID of the blockchain.
 * @returns {Token[]} An array of non-native currency tokens.
 */
export const getNonNativeCurrencyTokens = (tokens, nativeTokenId) => {
	return tokens.filter(token => token.id !== nativeTokenId) ?? [];
};
