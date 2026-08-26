import { useWalletController } from './useWalletController';
import { createAccountDisplayData } from '@/app/utils';
import { useMemo } from 'react';

/** @typedef {import('@/app/types/Account').AccountDisplayData} AccountDisplayData */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * React hook that resolves display data (name, known image, avatar color) for one account address
 * or a list of addresses from the wallet state. The resolution is memoized per input and wallet state.
 * @param {string|string[]} addressOrAddresses - A single address or a list of addresses to resolve.
 * @param {ChainName} [chainName] - The chain to resolve against. Defaults to the main chain.
 * @returns {AccountDisplayData|AccountDisplayData[]} Display data matching the input shape.
 */
export const useAccountDisplayData = (addressOrAddresses, chainName) => {
	const walletController = useWalletController(chainName);
	const { chainName: resolvedChainName, networkIdentifier, accounts } = walletController;
	const { addressBook } = walletController.modules;
	const walletAccounts = accounts[networkIdentifier];
	// The address book instance is stable across contact edits; its contacts array is what changes
	const contacts = addressBook?.contacts;
	const isArrayInput = Array.isArray(addressOrAddresses);
	const addresses = isArrayInput ? addressOrAddresses : [addressOrAddresses];
	// Memoize on the list content, as callers may build it inline
	const addressesKey = addresses.join();

	const displayDataList = useMemo(
		() => addresses.map(address => createAccountDisplayData(address, {
			walletAccounts,
			addressBook,
			chainName: resolvedChainName,
			networkIdentifier
		})),
		[addressesKey, walletAccounts, contacts, resolvedChainName, networkIdentifier]
	);

	return isArrayInput ? displayDataList : displayDataList[0];
};
