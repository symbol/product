import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { safeOperationWithRelativeAmounts } from 'wallet-common-core';

/**
 * Balance entry for an account, including the change delta and loading state.
 * @typedef {object} AccountBalance
 * @property {string} balance - Current account balance. Relative amount (as string).
 * @property {string} balanceChange - Difference between current and cached balance. Relative amount (as string).
 * @property {boolean} isLoading - Whether the balance is currently being fetched.
 */

/**
 * Calculates balance change between current and cached values.
 * @param {string} currentBalance - The current fetched balance.
 * @param {string} cachedBalance - The previously cached balance.
 * @param {number} divisibility - Network currency divisibility.
 * @returns {string} Formatted balance change string.
 */
const calculateBalanceChange = (currentBalance, cachedBalance, divisibility) => {
	return safeOperationWithRelativeAmounts(
		divisibility,
		[currentBalance, cachedBalance],
		(a, b) => a - b
	);
};

/**
 * React hook to fetch and manage account balances for all accounts in a network.
 * Returns balances with loading states and balance change calculations.
 * @param {import('wallet-common-core').WalletController} walletController - The wallet controller instance.
 * @returns {object} Object containing accountBalances map and refetch function.
 */
export const useAccountBalances = walletController => {
	const {
		accounts,
		accountInfos,
		networkIdentifier,
		networkProperties,
		networkApi
	} = walletController;

	const [balanceMap, setBalanceMap] = useState({});
	const [loadingMap, setLoadingMap] = useState({});

	const networkAccounts = useMemo(
		() => accounts[networkIdentifier] || [],
		[accounts, networkIdentifier]
	);

	// Use ref to access current accounts without triggering effect on reorder
	const networkAccountsRef = useRef(networkAccounts);
	networkAccountsRef.current = networkAccounts;

	// Create a stable key based on sorted public keys - only changes when accounts are added/removed
	const accountsKey = useMemo(
		() => [...networkAccounts].map(a => a.publicKey).sort().join(','),
		[networkAccounts]
	);

	const {divisibility} = networkProperties.networkCurrency;

	const fetchBalances = useCallback(async () => {
		const currentAccounts = networkAccountsRef.current;
		if (!currentAccounts.length)
			return;

		// Set all accounts to loading state
		const initialLoadingState = {};
		currentAccounts.forEach(account => {
			initialLoadingState[account.publicKey] = true;
		});
		setLoadingMap(initialLoadingState);

		// Fetch balances for each account
		const fetchPromises = currentAccounts.map(async account => {
			try {
				const balance = await networkApi.account.fetchAccountBalance(
					networkProperties,
					account.address
				);
				return { 
					publicKey: account.publicKey, 
					balance 
				};
			} catch (error) {
				return { 
					publicKey: account.publicKey, 
					balance: null
				};
			}
		});

		const results = await Promise.all(fetchPromises);

		// Update balance map with results
		const newBalanceMap = {};
		const newLoadingMap = {};

		results.forEach(({ publicKey, balance }) => {
			newBalanceMap[publicKey] = balance;
			newLoadingMap[publicKey] = false;
		});

		setBalanceMap(newBalanceMap);
		setLoadingMap(newLoadingMap);
	}, [networkApi, networkProperties]);

	// Calculate formatted balances with change indicators
	const accountBalances = useMemo(() => {
		const balances = {};

		networkAccounts.forEach(account => {
			const { publicKey } = account;
			const accountInfo = accountInfos[networkIdentifier][publicKey];
			
			const isCached = !!accountInfo?.fetchedAt;
			const cachedBalance = isCached ? accountInfo.balance : null;
			
			const currentBalance = balanceMap[publicKey] ?? null;
			const isLoading = loadingMap[publicKey] ?? true;
			const isCurrentAvailable = currentBalance !== null;

			// Determine display balance
			let balance;
			if (isCurrentAvailable)
				balance = currentBalance;
			else if (isCached)
				balance = cachedBalance;
			else
				balance = '0';

			// Calculate balance change
			const balanceChange = isCached && isCurrentAvailable
				? calculateBalanceChange(currentBalance, cachedBalance, divisibility)
				: '0';

			balances[publicKey] = {
				balance,
				balanceChange,
				isLoading
			};
		});

		return balances;
	}, [networkAccounts, accountInfos, networkIdentifier, balanceMap, loadingMap, divisibility]);

	// Fetch balances only when the set of accounts changes (not on reorder)
	useEffect(() => {
		fetchBalances();
	}, [accountsKey, networkApi, networkIdentifier]);

	return {
		accountBalances
	};
};
