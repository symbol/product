import { knownAccounts } from '@/app/config';
import { generateBlockie } from '@/app/lib/blockie';
import {
	isEthereumAddress,
	isPrivateKey as isEthereumPrivateKey,
	isPublicKey as isEthereumPublicKey
} from 'wallet-common-ethereum/src/utils/account';
import { 
	createPrivateAccount,
	generateKeyPair,
	isSymbolAddress,
	isPrivateKey as isSymbolPrivateKey,
	isPublicKey as isSymbolPublicKey
} from 'wallet-common-symbol/src/utils/account';

/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * Name and optional image ID for a known/labeled account entry.
 * @typedef {object} KnownAccount
 * @property {string} name - The name of the known account.
 * @property {string|null} imageId - The image ID of the known account, or null if not available.
 */

/**
 * Retrieves the known account entry from the known accounts configuration.
 * @param {ChainName} chainName - The name of the blockchain (e.g., 'symbol', 'ethereum').
 * @param {NetworkIdentifier} networkIdentifier - The network identifier (e.g., 'mainnet', 'testnet').
 * @param {string} address - The account address to look up.
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
 * Resolved display info for an account, sourced from wallet accounts, address book, or known config.
 * @typedef {object} KnownAccountInfo
 * @property {string} name - The name of the account stored in known configuration or other sources.
 * @property {string|null} imageId - The image ID of the known account, or null if not available.
 */

/**
 * Retrieves the account info from various sources: wallet accounts, address book, or known accounts config.
 * @param {string} address - The account address to look up.
 * @param {object} options - The options to search for the account name.
 * @param {WalletAccount[]} [options.walletAccounts] - The list of wallet accounts.
 * @param {object} [options.addressBook] - The address book instance.
 * @param {ChainName} [options.chainName] - The name of the blockchain (e.g., 'symbol', 'ethereum').
 * @param {NetworkIdentifier} [options.networkIdentifier] - The network identifier (e.g., 'mainnet', 'testnet').
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
 * @param {string} address - The account address to create display data for.
 * @param {object} options - The options to search for the account name and image.
 * @param {WalletAccount[]} [options.walletAccounts] - The list of wallet accounts.
 * @param {object} [options.addressBook] - The address book instance.
 * @param {ChainName} [options.chainName] - The name of the blockchain (e.g., 'symbol', 'ethereum').
 * @param {NetworkIdentifier} [options.networkIdentifier] - The network identifier (e.g., 'mainnet', 'testnet').
 * @returns {AccountDisplayData} An object containing the account address, name, imageId, and generated color if no image is available.
 */
export const createAccountDisplayData = (address, options) => {
	const knownInfo = getAccountKnownInfo(address, options);
	const blockie = generateBlockie(address);
	const color = blockie.background;

	return {
		address,
		name: knownInfo?.name ?? null,
		imageId: knownInfo?.imageId ?? null,
		color
	};
};

/**
 * Checks whether a value is a valid public key for the given blockchain.
 * @param {string} value - The value to check.
 * @param {ChainName} chainName - The blockchain name (e.g., 'symbol', 'ethereum').
 * @returns {boolean} True if the value is a valid public key.
 */
export const isPublicKey = (value, chainName) => {
	if (chainName === 'symbol')
		return isSymbolPublicKey(value);
	
	if (chainName === 'ethereum')
		return isEthereumPublicKey(value);
	
	throw new Error(`Unsupported chain name: ${chainName}`);
};

/**
 * Checks whether a value is a valid private key for the given blockchain.
 * @param {string} value - The value to check.
 * @param {ChainName} chainName - The blockchain name (e.g., 'symbol', 'ethereum').
 * @returns {boolean} True if the value is a valid private key.
 */
export const isPrivateKey = (value, chainName) => {
	if (chainName === 'symbol')
		return isSymbolPrivateKey(value);
	
	if (chainName === 'ethereum')
		return isEthereumPrivateKey(value);
	
	throw new Error(`Unsupported chain name: ${chainName}`);
};

/**
 * Checks whether a value is a valid address for the given blockchain.
 * @param {string} value - The value to check.
 * @param {ChainName} chainName - The blockchain name (e.g., 'symbol', 'ethereum').
 * @returns {boolean} True if the value is a valid address.
 */
export const isAddress = (value, chainName) => {
	if (chainName === 'symbol')
		return isSymbolAddress(value);
	
	if (chainName === 'ethereum')
		return isEthereumAddress(value);
	
	throw new Error(`Unsupported chain name: ${chainName}`);
};

/**
 * Generates a new private account for the Symbol blockchain.
 * @param {ChainName} chainName - The blockchain name (must be 'symbol').
 * @param {NetworkIdentifier} networkIdentifier - The network identifier.
 * @returns {import('@/app/types/Account').PrivateAccount} The generated private account.
 */
export const generateAccount = (chainName, networkIdentifier) => {
	if (chainName !== 'symbol')
		throw new Error(`Account generation is only supported for Symbol chain. Unsupported chain: ${chainName}`);
	
	const { privateKey } = generateKeyPair();
	
	return createPrivateAccount(privateKey, networkIdentifier);
};

