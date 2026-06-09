import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Balance and loading state for a single seed account.
 * @typedef {object} SeedAccountBalance
 * @property {string} balance - Current account balance. Relative amount (as string).
 * @property {boolean} isLoading - Whether the balance is currently being fetched.
 */

/**
 * React hook to fetch and manage account balances for seed accounts.
 * Returns balances with loading states.
 * @param {object} options - Hook options.
 * @param {Array} options.seedAccounts - Array of seed accounts to fetch balances for.
 * @param {object} options.networkProperties - Network properties.
 * @param {object} options.networkApi - Network API instance.
 * @returns {object} Object containing accountBalances map and refetch function.
 */
export const useSeedAccountBalances = ({ seedAccounts, networkProperties, networkApi }) => {
	const [balanceMap, setBalanceMap] = useState({});
	const [loadingMap, setLoadingMap] = useState({});

	const fetchBalances = useCallback(async () => {
		if (!seedAccounts.length)
			return;

		// Set all accounts to loading state
		const initialLoadingState = {};
		seedAccounts.forEach(account => {
			initialLoadingState[account.publicKey] = true;
		});
		setLoadingMap(initialLoadingState);

		// Fetch balances for each account
		const fetchPromises = seedAccounts.map(async account => {
			try {
				const balance = await networkApi.account.fetchAccountBalance(
					networkProperties,
					account.address
				);
				return { 
					publicKey: account.publicKey, 
					balance, 
					error: null 
				};
			} catch (error) {
				return { 
					publicKey: account.publicKey, 
					balance: null, 
					error 
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
	}, [seedAccounts, networkApi, networkProperties?.networkIdentifier]);

	// Calculate formatted balances
	const accountBalances = useMemo(() => {
		const balances = {};

		seedAccounts.forEach(account => {
			const { publicKey } = account;
			const balance = balanceMap[publicKey] ?? '0';
			const isLoading = loadingMap[publicKey] ?? true;

			balances[publicKey] = {
				balance,
				isLoading
			};
		});

		return balances;
	}, [seedAccounts, balanceMap, loadingMap]);

	// Fetch balances when seed accounts change
	useEffect(() => {
		fetchBalances();
	}, [fetchBalances]);

	return {
		accountBalances
	};
};
