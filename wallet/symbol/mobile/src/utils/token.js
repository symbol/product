import { knownTokens } from '@/app/config';
import { safeOperationWithRelativeAmounts } from 'wallet-common-core';

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
	const knownTokenEntry = knownTokens[chainName][networkIdentifier].find(token => token.tokenId === tokenId);

	return {
		name: knownTokenEntry ? knownTokenEntry.name : null,
		ticker: knownTokenEntry ? knownTokenEntry.ticker : null,
		imageId: knownTokenEntry ? knownTokenEntry.imageId : null
	};
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
	const totalFee = safeOperationWithRelativeAmounts(
		divisibility,
		transactionFeeTiers.map(feeTier => feeTier[speed].token.amount),
		(...args) => args.reduce((a, b) => a + b, 0n)
	);

	return safeOperationWithRelativeAmounts(
		divisibility,
		[tokenTotalBalance, totalFee],
		(a, b) => a - b
	);
};
