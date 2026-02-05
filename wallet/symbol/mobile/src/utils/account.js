import { knownAccounts } from '@/app/config';

/**
 * @typedef {object} KnownAccount
 * @property {string} name - The name of the known account.
 * @property {string|null} imageId - The image ID of the known account, or null if not available.
 */

/**
 * Retrieves the known account entry from the known accounts configuration.
 * 
 * @param {string} chainName - The name of the blockchain (e.g., 'symbol', 'ethereum').
 * @param {string} networkIdentifier - The network identifier (e.g., 'mainnet', 'testnet').
 * @param {string} address - The account address to look up.
 * 
 * @returns {KnownAccount|null} The known account entry if found, otherwise null.
 */
const getKnownAccountEntry = (chainName, networkIdentifier, address) => {
	const knownAccountEntry = knownAccounts[chainName]?.[networkIdentifier]?.find(account => account.accounts.includes(address));

	if (!knownAccountEntry)
		return null;

	return { 
		name: knownAccountEntry.name, 
		imageId: knownAccountEntry.imageId 
	};
};

const getContactName = (address, addressBook) => {
	const contact = addressBook?.getContactByAddress(address);
	return contact ? contact.name : null;
};

const getWalletAccountName = (address, walletAccounts) => {
	const walletAccount = walletAccounts?.find(account => address === account.address);
	return walletAccount ? walletAccount.name : null;
};

/**
 * @typedef {object} KnownAccountInfo
 * @property {string} name - The name of the account stored in known configuration or other sources.
 * @property {string|null} imageId - The image ID of the known account, or null if not available.
 */

/**
 * Retrieves the account info from various sources: wallet accounts, address book, or known accounts config.
 * 
 * @param {string} address - The account address to look up.
 * @param {object} options - The options to search for the account name.
 * @param {Array} [options.walletAccounts] - The list of wallet accounts.
 * @param {object} [options.addressBook] - The address book instance
 * @param {string} [options.chainName] - The name of the blockchain (e.g., 'symbol', 'ethereum').
 * @param {string} [options.networkIdentifier] - The network identifier (e.g., 'mainnet', 'testnet').
 * 
 * @returns {KnownAccountInfo} The account info if found, otherwise null.
 */
export const getAccountKnownInfo = (address, options) => {
	if (!address)
		return null;

	const { chainName, networkIdentifier } = options;
	let name = null;
	let imageId = null;

	name = getWalletAccountName(address, options.walletAccounts);
	name = getContactName(address, options.addressBook) ?? name;
	const knownAccountEntry = getKnownAccountEntry(chainName, networkIdentifier, address);
    
	if (knownAccountEntry) {
		name = knownAccountEntry.name ?? name;
		imageId = knownAccountEntry.imageId;
	}

	return { name, imageId };
};
