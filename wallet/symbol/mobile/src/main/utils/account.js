import { knownAccounts } from '@/app/config';
import { getBlockieColors } from '@/app/lib/blockie';
import {
	isEthereumAddress,
	isPrivateKey as isEthereumPrivateKey,
	isPublicKey as isEthereumPublicKey
} from 'wallet-common-ethereum/src/utils/account';
import {
	createPrivateAccount as createNemPrivateAccount,
	generateKeyPair as generateNemKeyPair,
	isNemAddress,
	isPrivateKey as isNemPrivateKey,
	isPublicKey as isNemPublicKey
} from 'wallet-common-nem/src/utils/account';
import {
	createPrivateAccount as createSymbolPrivateAccount,
	generateKeyPair as generateSymbolKeyPair,
	isSymbolAddress,
	isPrivateKey as isSymbolPrivateKey,
	isPublicKey as isSymbolPublicKey
} from 'wallet-common-symbol/src/utils/account';

/** @typedef {import('@/app/types/Account').AccountDisplayData} AccountDisplayData */
/** @typedef {import('@/app/types/Account').AccountResolveOptions} AccountResolveOptions */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */

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
 * @param {AccountResolveOptions} options - The options to search for the account name.
 * @returns {KnownAccountInfo} The account info if found, otherwise null.
 */
export const getAccountKnownInfo = (address, options) => {
	const { chainName, networkIdentifier } = options;
	let imageId = null;

	let name = getWalletAccountName(address, options.walletAccounts);
	name = getContactName(address, options.addressBook) ?? name;
	const knownAccountEntry = getKnownAccountEntry(chainName, networkIdentifier, address);
    
	if (knownAccountEntry) {
		name = knownAccountEntry.name ?? name;
		imageId = knownAccountEntry.imageId;
	}

	return { name, imageId };
};

/**
 * Creates account display data by combining known account information with generated color.
 * @param {string} address - The account address to create display data for.
 * @param {AccountResolveOptions} options - The options to search for the account name and image.
 * @returns {AccountDisplayData} An object containing the account address, name, imageId, and generated color if no image is available.
 */
export const createAccountDisplayData = (address, options) => {
	const knownInfo = getAccountKnownInfo(address, options);
	const color = getBlockieColors(address).background;

	return {
		address,
		name: knownInfo?.name ?? null,
		imageId: knownInfo?.imageId ?? null,
		color
	};
};

/**
 * Extracts the necessary state from a WalletController to create an options object used by `createAccountDisplayData()` function.
 * @param {WalletController} walletController - The wallet controller.
 * @returns {AccountResolveOptions} The account display options.
 */
export const getAccountDisplayOptions = walletController => ({
	walletAccounts: walletController.accounts[walletController.networkIdentifier],
	addressBook: walletController.modules.addressBook,
	chainName: walletController.chainName,
	networkIdentifier: walletController.networkIdentifier
});

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

	if (chainName === 'nem')
		return isNemPublicKey(value);

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

	if (chainName === 'nem')
		return isNemPrivateKey(value);

	throw new Error(`Unsupported chain name: ${chainName}`);
};

/**
 * Checks whether a value is a valid address for the given blockchain.
 * @param {string} value - The value to check.
 * @param {ChainName} chainName - The blockchain name (e.g., 'symbol', 'ethereum').
 * @param {NetworkIdentifier} [networkIdentifier] - The network identifier (required for Symbol address validation).
 * @returns {boolean} True if the value is a valid address.
 */
export const isAddress = (value, chainName, networkIdentifier) => {
	if (chainName === 'symbol')
		return isSymbolAddress(value, networkIdentifier);
	
	if (chainName === 'ethereum')
		return isEthereumAddress(value);

	if (chainName === 'nem')
		return isNemAddress(value, networkIdentifier);

	throw new Error(`Unsupported chain name: ${chainName}`);
};

/**
 * Generates a new private account for the Symbol or NEM blockchain.
 * @param {ChainName} chainName - The blockchain name (must be 'symbol' or 'nem').
 * @param {NetworkIdentifier} networkIdentifier - The network identifier.
 * @returns {import('@/app/types/Account').PrivateAccount} The generated private account.
 */
export const generateAccount = (chainName, networkIdentifier) => {
	if (chainName === 'symbol') {
		const { privateKey } = generateSymbolKeyPair();

		return createSymbolPrivateAccount(privateKey, networkIdentifier);
	}

	if (chainName === 'nem') {
		const { privateKey } = generateNemKeyPair();

		return createNemPrivateAccount(privateKey, networkIdentifier);
	}

	throw new Error(`Account generation is only supported for Symbol and NEM chains. Unsupported chain: ${chainName}`);
};

