import stateManager from '../stateManager.js';
import { getBIP44AddressKeyDeriver } from '@metamask/key-tree';
import {
	copyable, heading, panel, text
} from '@metamask/snaps-sdk';
import { PrivateKey } from 'symbol-sdk';
import { SymbolFacade } from 'symbol-sdk/symbol';
import { v4 as uuidv4 } from 'uuid';

const AccountType = {
	METAMASK: 'metamask',
	IMPORTED: 'import'
};

const accountUtils = {
	/**
	 * * Derives a key pair from a mnemonic and an address index.
	 * @param {'mainnet' | 'testnet'} networkName - The network name.
	 * @param {number} addressIndex - The address index.
	 * @returns {Promise<SymbolFacade.KeyPair>} - The derived key pair.
	 */
	async deriveKeyPair(networkName, addressIndex) {
		const facade = new SymbolFacade(networkName);
		const coinType = facade.bip32Path(addressIndex)[1];

		const rootNode = await snap.request({
			method: 'snap_getBip44Entropy',
			params: {
				coinType
			}
		});

		const derivePrivateKey = await getBIP44AddressKeyDeriver(rootNode);
		const key = await derivePrivateKey(addressIndex);

		const privateKey = new PrivateKey(key.privateKeyBytes);
		return new SymbolFacade.KeyPair(privateKey);
	},
	/**
	 * Get latest metamask account index.
	 * @param {Accounts} accounts - The accounts object.
	 * @param {'mainnet' | 'testnet'} networkName - The network name.
	 * @returns {number} - The latest account index.
	 */
	getLatestAccountIndex(accounts, networkName) {
		return Object.values(accounts)
			.filter(walletAccount =>
				AccountType.METAMASK === walletAccount.account.type
				&& networkName === walletAccount.account.networkName)
			.reduce((maxIndex, walletAccount) => Math.max(maxIndex, walletAccount.account.addressIndex), -1);
	},
	/**
	 * Get accounts by network name without private key.
	 * @param {Accounts} accounts - The accounts object.
	 * @param {'mainnet' | 'testnet'} networkName - The network name.
	 * @returns {Record<string, Account>} - The accounts object.
	 */
	getAccounts({ state }) {
		const { network, accounts } = state;

		return Object.keys(accounts).reduce((acc, key) => {
			if (accounts[key].account.networkName === network.networkName)
				acc[key] = accounts[key].account;

			return acc;
		}, {});
	},
	/**
	 * Create account and update state.
	 * @param {object} state - The snap state object.
	 * @param {SymbolFacade} facade - Symbol facade instance.
	 * @param {SymbolFacade.KeyPair} keyPair - The key pair object.
	 * @param {string} accountLabel - The account label.
	 * @param {'metamask' | 'import'} type - The snap account type.
	 * @param {number} addressIndex - The address index.
	 * @returns {Account} - The account object.
	 */
	async createAccountAndUpdateState({
		state, facade, keyPair, accountLabel, type, addressIndex = null
	}) {
		const { network } = state;
		const accountId = uuidv4();

		const newAccount = {
			account: {
				id: accountId,
				addressIndex,
				type,
				label: accountLabel,
				address: facade.network.publicKeyToAddress(keyPair.publicKey).toString(),
				publicKey: keyPair.publicKey.toString(),
				networkName: network.networkName
			},
			privateKey: keyPair.privateKey.toString()
		};

		state.accounts = {
			...state.accounts,
			[accountId]: newAccount
		};

		await stateManager.update(state);

		return newAccount.account;
	},
	async createAccount({ state, requestParams }) {
		try {
			const { accountLabel } = requestParams;
			const { network, accounts } = state;

			const facade = new SymbolFacade(network.networkName);

			// Get the latest account index and increment it if it exists
			const newAddressIndex = this.getLatestAccountIndex(accounts, network.networkName) + 1 || 0;
			const keyPair = await this.deriveKeyPair(network.networkName, newAddressIndex);

			return await this.createAccountAndUpdateState({
				state, facade, keyPair, accountLabel, type: AccountType.METAMASK, addressIndex: newAddressIndex
			});
		} catch (error) {
			throw new Error(`Failed to create account: ${error.message}`);
		}
	},
	async importAccount({ state, requestParams }) {
		try {
			const { privateKey, accountLabel } = requestParams;
			const { accounts, network } = state;

			const keyPair = new SymbolFacade.KeyPair(new PrivateKey(privateKey));
			const existingAccount = Object.values(accounts).find(account => account.privateKey === keyPair.privateKey.toString());

			if (existingAccount) {
				await snap.request({
					method: 'snap_dialog',
					params: {
						type: 'alert',
						content: panel([
							heading('Import account'),
							text('Account already exists.')
						])
					}
				});

				return existingAccount.account;
			}

			const facade = new SymbolFacade(network.networkName);

			const confirmationResponse = await snap.request({
				method: 'snap_dialog',
				params: {
					type: 'confirmation',
					content: panel([
						heading('Import account'),
						heading('Address:'),
						copyable(`${facade.network.publicKeyToAddress(keyPair.publicKey).toString()}`),
						heading('Public Key:'),
						copyable(`${keyPair.publicKey.toString()}`)
					])
				}
			});

			// User cancelled the import
			if (!confirmationResponse)
				return confirmationResponse;

			return await this.createAccountAndUpdateState({
				state, facade, keyPair, accountLabel, type: AccountType.IMPORTED
			});
		} catch (error) {
			throw new Error(`Failed to import account: ${error.message}`);
		}
	}
};

export default accountUtils;

// region type declarations

/**
 * state of the account.
 * @typedef {object} Account
 * @property {string} id - The account id generated by uuid.
 * @property {number} addressIndex - The address index from bip 44.
 * @property {'metamask' | 'import'} type - The wallet type.
 * @property {'mainnet' | 'testnet'} networkName - network name.
 * @property {string} label - The account label.
 * @property {string} address - The account address.
 * @property {string} publicKey - The account public key.
 */

/**
 * Accounts object.
 * @typedef {Record<string, { account: Account, privateKey: string }>} Accounts
 */

// endregion
