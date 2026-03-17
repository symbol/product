import { knownAccounts } from '@/app/config';
import { generateBlockie } from '@/app/lib/blockie';

/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */

/**
 * @typedef {object} KnownAccount
 * @property {string} name - The name of the known account.
 * @property {string|null} imageId - The image ID of the known account, or null if not available.
 */

/**
 * Retrieves the known account entry from the known accounts configuration.
 * 
 * @param {string} chainName - The name of the blockchain (e.g., 'symbol', 'ethereum').
 * @param {NetworkIdentifier} networkIdentifier - The network identifier (e.g., 'mainnet', 'testnet').
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
 * @param {WalletAccount[]} [options.walletAccounts] - The list of wallet accounts.
 * @param {object} [options.addressBook] - The address book instance
 * @param {string} [options.chainName] - The name of the blockchain (e.g., 'symbol', 'ethereum').
 * @param {NetworkIdentifier} [options.networkIdentifier] - The network identifier (e.g., 'mainnet', 'testnet').
 * 
 * @returns {KnownAccountInfo} The account info if found, otherwise null.
 */
export const getAccountKnownInfo = (address, options) => {
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

/**
 * Account display data structure.
 * @typedef {object} AccountDisplayData
 * @property {string} address - The account address.
 * @property {string} name - The display name for the account.
 * @property {string|null} imageId - The image ID for the account avatar, or null if not available.
 * @property {string} color - The generated color for the account avatar when no image is available.
 */

/**
 * Creates account display data by combining known account information with generated color.
 * 
 * @param {string} address - The account address to create display data for.
 * @param {object} options - The options to search for the account name and image.
 * @param {WalletAccount[]} [options.walletAccounts] - The list of wallet accounts.
 * @param {object} [options.addressBook] - The address book instance
 * @param {string} [options.chainName] - The name of the blockchain (e.g., 'symbol', 'ethereum').
 * @param {NetworkIdentifier} [options.networkIdentifier] - The network identifier (e.g., 'mainnet', 'testnet').
 * 
 * @returns {AccountDisplayData} An object containing the account address, name, imageId, and generated color if no image is available.
 */
export const createAccountDisplayData = (address, options) => {
	const knownInfo = getAccountKnownInfo(address, options);
	const blockie = generateBlockie(address);
	const color = blockie.background;

	return {
		address,
		name: knownInfo?.name ?? address,
		imageId: knownInfo?.imageId ?? null,
		color
	};
};
