import mosaicUtils from './mosaicUtils.js';
import symbolClient from '../services/symbolClient.js';
import stateManager from '../stateManager.js';
import { getBIP44AddressKeyDeriver } from '@metamask/key-tree';
import {
	copyable, heading, panel, text
} from '@metamask/snaps-sdk';
import { PrivateKey } from 'symbol-sdk';
import { KeyPair, SymbolFacade } from 'symbol-sdk/symbol';
import { v4 as uuidv4 } from 'uuid';

const AccountType = {
	METAMASK: 'metamask',
	IMPORTED: 'import'
};

/**
 * Sort mosaics array, XYM will always at top.
 * @param {Array<AccountMosaics>} mosaics - The mosaics array.
 * @param {string} mosaicId - The mosaic id.
 * @returns {Array<AccountMosaics>} - The sorted mosaics array.
 */
const sortXYMMosaics = (mosaics, mosaicId) => {
	const xymMosaics = mosaics.filter(mosaic => mosaic.id === mosaicId);
	const otherMosaics = mosaics.filter(mosaic => mosaic.id !== mosaicId);
	return [...xymMosaics, ...otherMosaics];
};

const accountUtils = {
	/**
	 * * Derives a key pair from a mnemonic and an address index.
	 * @param {'mainnet' | 'testnet'} networkName - The network name.
	 * @param {number} addressIndex - The address index.
	 * @returns {Promise<KeyPair>} - The derived key pair.
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
		return new KeyPair(privateKey);
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
	 * @param {SymbolAccount} symbolAccount - Symbol account instance.
	 * @param {string} accountLabel - The account label.
	 * @param {'metamask' | 'import'} type - The snap account type.
	 * @param {number} addressIndex - The address index.
	 * @returns {Account} - The account object.
	 */
	async createAccountAndUpdateState({
		state, symbolAccount, accountLabel, type, addressIndex = null
	}) {
		const { network } = state;
		const accountId = uuidv4();

		const address = symbolAccount.address.toString();
		const accountsMosaics = await this.fetchAndUpdateAccountMosaics(state, [address]);

		const newAccount = {
			account: {
				id: accountId,
				addressIndex,
				type,
				label: accountLabel,
				address,
				publicKey: symbolAccount.publicKey.toString(),
				networkName: network.networkName,
				mosaics: sortXYMMosaics(accountsMosaics[address] || [], network.currencyMosaicId)
			},
			privateKey: symbolAccount.keyPair.privateKey.toString()
		};

		state.accounts = {
			...state.accounts,
			[accountId]: newAccount
		};

		await stateManager.update(state);

		return newAccount.account;
	},
	/**
	 * Find account by private key.
	 * @param {Accounts} accounts - The accounts object.
	 * @param {string} privateKey - The private key.
	 * @returns {Account | undefined} - The account object.
	 */
	findAccountByPrivateKey(accounts, privateKey) {
		return Object.values(accounts).find(account => account.privateKey === privateKey);
	},
	async createAccount({ state, requestParams }) {
		try {
			const { accountLabel } = requestParams;
			const { network, accounts } = state;

			const facade = new SymbolFacade(network.networkName);

			// Get the latest account index and increment it if it exists
			const newAddressIndex = this.getLatestAccountIndex(accounts, network.networkName) + 1 || 0;
			const keyPair = await this.deriveKeyPair(network.networkName, newAddressIndex);
			const symbolAccount = facade.createAccount(keyPair.privateKey);

			return await this.createAccountAndUpdateState({
				state, symbolAccount, accountLabel, type: AccountType.METAMASK, addressIndex: newAddressIndex
			});
		} catch (error) {
			throw new Error(`Failed to create account: ${error.message}`);
		}
	},
	async importAccount({ state, requestParams }) {
		try {
			const { privateKey, accountLabel } = requestParams;
			const { accounts, network } = state;

			const facade = new SymbolFacade(network.networkName);

			const symbolAccount = facade.createAccount(new PrivateKey(privateKey));
			const existingAccount = this.findAccountByPrivateKey(accounts, symbolAccount.keyPair.privateKey.toString());

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

			const confirmationResponse = await snap.request({
				method: 'snap_dialog',
				params: {
					type: 'confirmation',
					content: panel([
						heading('Import account'),
						heading('Address:'),
						copyable(`${symbolAccount.address.toString()}`),
						heading('Public Key:'),
						copyable(`${symbolAccount.publicKey.toString()}`)
					])
				}
			});

			// User cancelled the import
			if (!confirmationResponse)
				return confirmationResponse;

			return await this.createAccountAndUpdateState({
				state, symbolAccount, accountLabel, type: AccountType.IMPORTED
			});
		} catch (error) {
			throw new Error(`Failed to import account: ${error.message}`);
		}
	},
	/**
	 * Fetch account mosaic and update mosaic info.
	 * @param {{ network: object }} state - The snap state object.
	 * @param {Array<string>} addresses - The account addresses.
	 * @returns {Promise<Record<string, Array<AccountMosaics>>>} - The accounts mosaics object.
	 */
	async fetchAndUpdateAccountMosaics(state, addresses) {
		const { network } = state;

		const client = symbolClient.create(network.url);
		const accountsMosaics = await client.fetchAccountsMosaics(addresses);

		// Get all unique mosaic ids
		const mosaicIds = [...new Set(Object.values(accountsMosaics).flatMap(accountMosaics => accountMosaics.map(mosaic => mosaic.id)))];

		await mosaicUtils.updateMosaicInfo(state, mosaicIds);

		return accountsMosaics;
	},
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
 * @property {Array<AccountMosaics>} mosaics - The account mosaics.
 */

/**
 * Accounts object.
 * @typedef {Record<string, { account: Account, privateKey: string }>} Accounts
 */

/**
 * Account mosaics
 * @typedef {object} AccountMosaics
 * @property {string} id - The mosaic id.
 * @property {number} amount - The mosaic amount.
 */

// endregion
