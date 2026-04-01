import { getAccountKnownInfo, getAvailableBalance } from '@/app/utils';

/** @typedef {import('@/app/types/Token').Token} Token */
/** @typedef {import('@/app/types/Transaction').TransactionFeeTiers} TransactionFeeTiers */
/** @typedef {import('@/app/types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/screens/send/types/Send').SenderOption} SenderOption */

/**
 * Creates sender options for the dropdown from addresses.
 *
 * @param {string[]} addresses - Array of sender addresses.
 * @param {Object} options - Options for resolving account names.
 * @param {WalletAccount[]} options.walletAccounts - List of wallet accounts.
 * @param {Object} options.addressBook - The address book instance.
 * @param {string} options.chainName - The blockchain name.
 * @param {string} options.networkIdentifier - The network identifier.
 * @returns {SenderOption[]} Array of sender options.
 */
export const createSenderOptions = (addresses, options) => {
	const { walletAccounts, addressBook, chainName, networkIdentifier } = options;

	return addresses.map(address => {
		const knownInfo = getAccountKnownInfo(address, {
			walletAccounts,
			addressBook,
			chainName,
			networkIdentifier
		});

		return {
			value: address,
			label: knownInfo.name || address
		};
	});
};

/**
 * Calculates the available balance for the selected token.
 *
 * @param {Token|null} selectedToken - The selected token.
 * @param {string|null} nativeTokenId - The native currency token ID.
 * @param {TransactionFeeTiers|null} transactionFees - Transaction fee tiers.
 * @param {TransactionFeeTierLevel} transactionSpeed - Selected transaction speed.
 * @returns {string} The available balance.
 */
export const calculateTokenAvailableBalance = (
	selectedToken,
	nativeTokenId,
	transactionFees,
	transactionSpeed
) => {
	if (!selectedToken?.id || !selectedToken?.amount)
		return '0';

	if (!transactionFees)
		return selectedToken.amount;

	return getAvailableBalance(
		selectedToken,
		nativeTokenId,
		transactionFees,
		transactionSpeed
	);
};

/**
 * Filters tokens by expiration, removing expired tokens.
 *
 * @param {Token[]} tokens - List of tokens.
 * @param {number} chainHeight - Current chain height.
 * @returns {Token[]} Filtered list of non-expired tokens.
 */
export const filterActiveTokens = (tokens, chainHeight) => 
	tokens.filter(token => token.endHeight > chainHeight || !token.duration);

/**
 * Gets the token price if it's the native currency.
 *
 * @param {string|null} selectedTokenId - The selected token ID.
 * @param {string|null} nativeTokenId - The native currency token ID.
 * @param {number|null} price - The native currency price.
 * @returns {number|null} The price or null if not native currency.
 */
export const getSelectedTokenPrice = (selectedTokenId, nativeTokenId, price) => {
	const isNativeToken = selectedTokenId === nativeTokenId;
	return isNativeToken ? price : null;
};
