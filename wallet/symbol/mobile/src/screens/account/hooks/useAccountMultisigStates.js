import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** @typedef {import('@/app/types/Wallet').MainWalletController} MainWalletController */

/**
 * React hook to resolve which of the network accounts are multisig. Seeds the result from the
 * cached account infos for instant display, then refreshes each entry with a light multisig
 * info request.
 * @param {MainWalletController} walletController - The wallet controller instance.
 * @returns {{ accountMultisigStates: {[publicKey: string]: boolean} }} Map of account public keys to their multisig state.
 */
export const useAccountMultisigStates = walletController => {
	const {
		accounts,
		accountInfos,
		networkIdentifier,
		networkProperties,
		networkApi
	} = walletController;

	const [fetchedStates, setFetchedStates] = useState({});

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

	const fetchMultisigStates = useCallback(async () => {
		const currentAccounts = networkAccountsRef.current;
		if (!currentAccounts.length)
			return;

		// Fetch multisig info for each account. A failed request keeps the cached value
		const fetchPromises = currentAccounts.map(async account => {
			try {
				const multisigInfo = await networkApi.account.fetchMultisigInfo(
					networkProperties,
					account.address
				);

				return {
					publicKey: account.publicKey,
					isMultisig: multisigInfo.cosignatories.length > 0
				};
			} catch (error) {
				return null;
			}
		});

		const results = await Promise.all(fetchPromises);

		const newFetchedStates = {};
		results.forEach(result => {
			if (result)
				newFetchedStates[result.publicKey] = result.isMultisig;
		});

		setFetchedStates(newFetchedStates);
	}, [networkApi, networkProperties]);

	// Merge maps. Fetched state wins over the cached account info seed
	const accountMultisigStates = useMemo(() => {
		const states = {};

		networkAccounts.forEach(account => {
			const cachedInfo = accountInfos[networkIdentifier][account.publicKey];
			states[account.publicKey] = fetchedStates[account.publicKey] ?? cachedInfo?.isMultisig ?? false;
		});

		return states;
	}, [networkAccounts, accountInfos, networkIdentifier, fetchedStates]);

	// Fetch multisig states only when the set of accounts changes (not on reorder)
	useEffect(() => {
		fetchMultisigStates();
	}, [accountsKey, networkApi, networkIdentifier]);

	return {
		accountMultisigStates
	};
};
