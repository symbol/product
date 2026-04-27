import { AggregateTypes, TransferTypes } from '@/app/screens/history/constants';
import { AmountChangeType, AmountDisplaySize } from '@/app/screens/history/types/AmountBreakdown';
import { createTokenDisplayData, getAccountKnownInfo } from '@/app/utils';
import { safeOperationWithRelativeAmounts } from 'wallet-common-core';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Token').Token} Token */
/** @typedef {import('@/app/screens/history/types/AmountBreakdown').AmountBreakdownMap} AmountBreakdownMap */
/** @typedef {import('@/app/screens/history/types/AmountBreakdown').AmountBreakdownDisplayData} AmountBreakdownDisplayData */
/** @typedef {import('@/app/screens/history/types/AmountBreakdown').TokenAmountChange} TokenAmountChange */

/**
 * Ensures an account entry exists in the breakdown map.
 * @param {AmountBreakdownMap} breakdownMap - The breakdown map to update.
 * @param {string} address - The account address.
 */
const ensureAccountEntry = (breakdownMap, address) => {
	if (!breakdownMap[address])
		breakdownMap[address] = { tokens: {} };
};

/**
 * Updates the token amount for a specific account in the breakdown map.
 * @param {AmountBreakdownMap} breakdownMap - The breakdown map to update.
 * @param {string} address - The account address.
 * @param {Token} token - The token with amount and metadata.
 * @param {AmountChangeType} changeType - The type of amount change (increase or decrease).
 */
const updateTokenAmount = (breakdownMap, address, token, changeType) => {
	ensureAccountEntry(breakdownMap, address);

	const tokenId = token.id;
	const { divisibility } = token;
	const existingToken = breakdownMap[address].tokens[tokenId];
	const existingAmount = existingToken?.amount ?? '0';
	const changeAmount = token.amount ?? '0';

	const newAmount = safeOperationWithRelativeAmounts(
		divisibility,
		[existingAmount, changeAmount],
		(existing, change) => changeType === AmountChangeType.INCREASE
			? existing + change
			: existing - change
	);

	breakdownMap[address].tokens[tokenId] = {
		tokenId,
		name: token.name,
		amount: newAmount,
		divisibility
	};
};

/**
 * Processes a transfer transaction and updates the breakdown map.
 * @param {Transaction} transaction - The transfer transaction.
 * @param {AmountBreakdownMap} breakdownMap - The breakdown map to update.
 */
const processTransferTransaction = (transaction, breakdownMap) => {
	const tokens = transaction.mosaics ?? transaction.tokens ?? [];
	const { signerAddress } = transaction;
	const { recipientAddress } = transaction;

	for (const token of tokens) {
		updateTokenAmount(breakdownMap, signerAddress, token, AmountChangeType.DECREASE);
		updateTokenAmount(breakdownMap, recipientAddress, token, AmountChangeType.INCREASE);
	}
};

/**
 * Recursively processes a transaction and updates the breakdown map.
 * @param {Transaction} transaction - The transaction to process.
 * @param {AmountBreakdownMap} breakdownMap - The breakdown map to update.
 */
const processTransaction = (transaction, breakdownMap) => {
	if (TransferTypes.includes(transaction.type))
		processTransferTransaction(transaction, breakdownMap);

	if (AggregateTypes.includes(transaction.type) && transaction.innerTransactions) {
		for (const innerTx of transaction.innerTransactions)
			processTransaction(innerTx, breakdownMap);

	}
};

/**
 * Calculates the amount breakdown for a transaction.
 * Returns a map of account addresses to their token balance changes.
 * 
 * @param {Transaction} transaction - The transaction to analyze.
 * @returns {AmountBreakdownMap} Map of account addresses to token changes.
 */
export const calculateAmountBreakdown = transaction => {
	const breakdownMap = {};

	processTransaction(transaction, breakdownMap);

	return breakdownMap;
};

/**
 * Ensures the current account has an entry for the native token in the breakdown map.
 * If the current account is not involved in the transaction, it will add an entry with zero amount.
 * 
 * @param {AmountBreakdownMap} breakdownMap - The breakdown map to update.
 * @param {string} currentAccountAddress - The current wallet account address.
 * @param {string} nativeCurrencyTokenId - The native currency token ID.
 */
const ensureCurrentAccountHasNativeTokenEntry = (breakdownMap, currentAccountAddress, nativeCurrencyTokenId) => {
	if (!breakdownMap[currentAccountAddress])
		breakdownMap[currentAccountAddress] = { tokens: {} };

	if (!breakdownMap[currentAccountAddress].tokens[nativeCurrencyTokenId]) {
		breakdownMap[currentAccountAddress].tokens[nativeCurrencyTokenId] = {
			tokenId: nativeCurrencyTokenId,
			name: null,
			amount: '0',
			divisibility: null
		};
	}
};

/**
 * Determines the amount change type based on the amount string.
 * @param {string} amount - The amount string.
 * @returns {AmountChangeType} The change type.
 */
const getAmountChangeType = amount => {
	if (amount === '0')
		return AmountChangeType.NONE;

	if (amount.startsWith('-'))
		return AmountChangeType.DECREASE;

	return AmountChangeType.INCREASE;
};

/**
 * Formats the amount string with a sign prefix.
 * @param {string} amount - The amount string.
 * @param {AmountChangeType} changeType - The type of amount change.
 * @returns {string} Formatted amount with sign.
 */
const formatAmountWithSign = (amount, changeType) => {
	if (changeType === AmountChangeType.INCREASE)
		return `+${amount}`;

	return amount;
};

/**
 * Options for creating amount breakdown display data.
 * @typedef {Object} AmountBreakdownDisplayOptions
 * @property {string} chainName - The blockchain name.
 * @property {string} networkIdentifier - The network identifier.
 * @property {string} nativeCurrencyTokenId - The native currency token ID.
 * @property {string} [currentAccountAddress] - The current wallet account address.
 * @property {import('@/app/types/Account').WalletAccount[]} [walletAccounts] - The wallet accounts.
 * @property {Object} [addressBook] - The address book instance.
 */

/**
 * Creates display-ready amount breakdown data from a transaction.
 * 
 * @param {Transaction} transaction - The transaction to analyze.
 * @param {AmountBreakdownDisplayOptions} options - Display options including chain context.
 * @returns {AmountBreakdownDisplayData} Display-ready breakdown data.
 */
export const createAmountBreakdownDisplayData = (transaction, options) => {
	const {
		chainName,
		networkIdentifier,
		nativeCurrencyTokenId,
		currentAccountAddress,
		walletAccounts,
		addressBook
	} = options;

	const breakdownMap = calculateAmountBreakdown(transaction);
	const accountDisplayOptions = { chainName, networkIdentifier, walletAccounts, addressBook };

	// Ensure current account always has a native token entry in the breakdown
	if (currentAccountAddress)
		ensureCurrentAccountHasNativeTokenEntry(breakdownMap, currentAccountAddress, nativeCurrencyTokenId);

	// Build breakdown display rows
	/** @type {import('@/app/screens/history/types/AmountBreakdown').BreakdownDisplayRow[]} */
	const breakdown = [];

	for (const [address, accountBreakdown] of Object.entries(breakdownMap)) {
		const accountKnownInfo = getAccountKnownInfo(address, accountDisplayOptions);
		const account = {
			address,
			name: accountKnownInfo.name
		};

		/** @type {import('@/app/screens/history/types/AmountBreakdown').AmountDisplayItem[]} */
		const amounts = [];

		// Sort tokens: native currency first, then custom tokens
		const tokenEntries = Object.entries(accountBreakdown.tokens);
		const sortedTokenEntries = tokenEntries.sort(([tokenIdA], [tokenIdB]) => {
			if (tokenIdA === nativeCurrencyTokenId)
				return -1;

			if (tokenIdB === nativeCurrencyTokenId)
				return 1;

			return 0;
		});

		for (const [tokenId, tokenChange] of sortedTokenEntries) {
			const token = {
				id: tokenId,
				name: tokenChange.name,
				divisibility: tokenChange.divisibility
			};
			const tokenDisplayData = createTokenDisplayData(token, chainName, networkIdentifier);
			const isNativeToken = tokenId === nativeCurrencyTokenId;

			const changeType = getAmountChangeType(tokenChange.amount);
			const amountText = formatAmountWithSign(tokenChange.amount, changeType);
			const label = tokenDisplayData.ticker ?? tokenDisplayData.name;

			amounts.push({
				tokenId,
				amountText,
				type: changeType,
				label,
				size: isNativeToken ? AmountDisplaySize.MEDIUM : AmountDisplaySize.SMALL
			});
		}

		breakdown.push({ account, amounts });
	}

	const sortedBreakdown = breakdown.sort((a, b) => {
		if (a.account.address === currentAccountAddress)
			return -1;

		if (b.account.address === currentAccountAddress)
			return 1;

		return 0;
	});

	// Calculate current account summary
	const currentAccountBreakdown = sortedBreakdown.find(item => item.account.address === currentAccountAddress);
	const nativeAmount = currentAccountBreakdown?.amounts.find(item => item.tokenId === nativeCurrencyTokenId);
	const currentAccountSummary = {
		amountText: nativeAmount?.amountText ?? '0',
		type: nativeAmount?.type ?? AmountChangeType.NONE
	};

	return {
		currentAccount: currentAccountSummary,
		breakdown,
		isBreakdownVisible: !!transaction.innerTransactions
	};
};
