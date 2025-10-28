import { BaseSoftwareKeystore } from './BaseSoftwareKeystore';
import { WalletAccountType } from '../../constants';
import { KeystoreError } from '../../error/KeystoreError';
import { cloneNetworkArrayMap, createNetworkMap } from '../../utils/network';

/** @typedef {import('../../types/Account').PublicAccount} PublicAccount */

const createDefaultState = networkIdentifiers => ({
	mnemonic: null,
	privateAccounts: createNetworkMap(() => ([]), networkIdentifiers)
});

export class MnemonicKeystore extends BaseSoftwareKeystore {
	static type = WalletAccountType.MNEMONIC;

	constructor({ secureStorageInterface, sdk, networkIdentifiers }) {
		super({
			secureStorageInterface,
			sdk,
			networkIdentifiers
		});

		this._state = createDefaultState(networkIdentifiers);
	}

	/**
	 * Loads mnemonic and accounts from secure storage and initializes the keystore state.
	 * @param {string} [password] - The password to access secure storage.
	 * @returns {Promise<void>} A promise that resolves when the mnemonic and accounts are loaded.
	 */
	loadCache = async password => {
		// Reset the state to default
		this._state = createDefaultState(this.networkIdentifiers);

		// Load mnemonic and accounts from secure storage
		this._state.mnemonic = await this.secureStorageRepository.getMnemonic(password);
		const accountsOrNull = await this.secureStorageRepository.getAccounts(password);
		this._state.privateAccounts = cloneNetworkArrayMap(accountsOrNull, this.networkIdentifiers, this._state.privateAccounts);
	};

	/**
	 * Creates a new wallet with a mnemonic and generates accounts for each network.
	 * @param {string} mnemonic - The mnemonic phrase to create the wallet.
	 * @param {number} accountPerNetworkCount - The number of accounts to create per network.
	 * @param {string} [password] - The password to access secure storage.
	 * @returns {Promise<void>} A promise that resolves when the wallet is created and accounts are saved.
	 * @throws {Error} If the mnemonic cannot be saved or if accounts cannot be generated and saved.
	 */
	createWallet = async (mnemonic, accountPerNetworkCount, password) => {
		// Save the mnemonic securely
		await this.secureStorageRepository.setMnemonic(mnemonic, password);

		// Generate accounts from the mnemonic
		const seedIndexes = [...Array(accountPerNetworkCount).keys()];
		const privateAccounts = createNetworkMap(
			networkIdentifier =>
				this.sdk.createPrivateKeysFromMnemonic(mnemonic, seedIndexes, networkIdentifier).map((privateKey, index) =>
					this.sdk.createPrivateAccount(
						privateKey,
						networkIdentifier,
						WalletAccountType.MNEMONIC,
						index
					)),
			this.networkIdentifiers
		);

		// Save the accounts securely
		await this.secureStorageRepository.setAccounts(privateAccounts, password);
		await this.loadCache(password);
	};

	/**
	 * Retrieves the mnemonic phrase
	 * @returns {string|null} The mnemonic phrase or null if not set.
	 */
	getMnemonic = () => {
		return this._state.mnemonic;
	};

	/**
	 * Retrieves the seed account for a specific network and index.
	 * @param {string} networkIdentifier - The network identifier.
	 * @param {number} index - The index of the account.
	 * @returns {Promise<PublicAccount>} A promise that resolves to the seed account.
	 * @throws {KeystoreError} If the network is not supported or if the account does not exist.
	 */
	getSeedAccount = async (networkIdentifier, index) => {
		const { privateAccounts } = this._state;

		if (!privateAccounts[networkIdentifier])
			throw new KeystoreError(`Failed to get seed account. Network "${networkIdentifier}" is not supported by this keystore.`);

		const account = privateAccounts[networkIdentifier][index];

		if (!account) {
			throw new KeystoreError('Failed to get seed account. ' 
				+ `Account with index ${index} in network "${networkIdentifier}" does not exist in this keystore.`);
		}

		return account;
	};

	/**
	 * Clears the keystore by resetting the state and removing all accounts from secure storage.
	 * @param {string} [password] - The password to access secure storage.
	 * @returns {Promise<void>} A promise that resolves when the keystore is cleared.
	 */
	clear = async password => {
		this._state = createDefaultState(this.networkIdentifiers);
		await this.secureStorageRepository.clear(password);
	};
}
