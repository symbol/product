import { TransactionGroup, defaultSnapOrigin } from '../config';
import { toast } from 'react-toastify';

const symbolSnapFactory = {
	create(provider) {
		return {
			provider: provider,
			/**
			 * A helper function to invoke a method in the snap.
			 * @param {string} method - The method to invoke.
			 * @param {object} params - The params to pass with the method.
			 * @returns {object} The response from the snap.
			 */
			async invokeSnapMethod(method, params = {}) {
				try {
					return await this.provider.request({
						method: 'wallet_invokeSnap',
						params: {
							snapId: defaultSnapOrigin,
							request: {
								method,
								...(Object.keys(params).length && { params })
							}
						}
					});
				} catch (error) {
					toast.error('Metamask RPC Error: ' + error.message);
				}
			},
			/**
			 * Get the installed snaps in MetaMask.
			 * @returns {object} The snaps installed in MetaMask.
			 */
			async getSnaps() {
				try {
					return await this.provider.request({
						method: 'wallet_getSnaps'
					});
				} catch {
					return {};
				}
			},
			/**
			 * Get the snap from MetaMask.
			 * @param {string} version - The version of the snap to install (optional).
			 * @returns {object} The snap object returned by the extension.
			 */
			async getSnap(version) {
				const snaps = await this.getSnaps();

				return Object.values(snaps).find(snap =>
					snap.id === defaultSnapOrigin && (!version || snap.version === version));
			},
			/**
			 * Connect a snap to MetaMask.
			 * @param {string} snapId - The ID of the snap.
			 * @param {object} params - The params to pass with the snap to connect.
			 * @returns {boolean} A boolean indicating if the snap was connected.
			 */
			async connectSnap(snapId = defaultSnapOrigin, params = {}) {
				try {
					await provider.request({
						method: 'wallet_requestSnaps',
						params: {
							[snapId]: params
						}
					});
					return true;
				} catch {
					return false;
				}
			},
			/**
			 * Get current selected network from snap MetaMask.
			 * @returns {object} The network object returned by the snap.
			 */
			async getNetwork() {
				const networkData = await this.invokeSnapMethod('getNetwork');

				return networkData;
			},
			/**
			 * Switch network in snap MetaMask.
			 * @param {NetworkName} networkName - The name of the network to switch to.
			 * @returns {object} The network object returned by the snap.
			 */
			async switchNetwork(networkName) {
				const network = await this.invokeSnapMethod('switchNetwork', {
					networkName
				});

				return network;
			},
			/**
			 * Get the initial snap state.
			 * @param {NetworkName} networkName - The name of the network to switch to.
			 * @param {'usd' | 'jpy'} currency - The currency to get the price for.
			 * @returns {object} The initial snap state.
			 */
			async initialSnap(networkName, currency) {
				const initialSnapState = await this.invokeSnapMethod('initialSnap', {
					networkName,
					currency
				});

				return initialSnapState;
			},
			/**
			 * Create an account in snap MetaMask.
			 * @param {string} accountLabel - The label of the account.
			 * @returns {Account} The account object returned by the snap.
			 */
			async createAccount(accountLabel) {
				const account = await this.invokeSnapMethod('createAccount', {
					accountLabel
				});

				return account;
			},
			async importAccount(accountLabel, privateKey) {
				const account = await this.invokeSnapMethod('importAccount', {
					accountLabel,
					privateKey
				});

				return account;
			},
			/**
			 * Get the currency price from snap MetaMask.
			 * @param {string} currency - The currency to get the price for.
			 * @returns {Promise<Currency>} The price of the currency.
			 */
			async getCurrency(currency) {
				const price = await this.invokeSnapMethod('getCurrency', {
					currency
				});

				return price;
			},
			/**
			 * Fetch account mosaics from snap MetaMask.
			 * @param {Array<string>} accountIds - The ID of the account.
			 * @returns {Promise<Record<string, Account>>} The mosaics object returned by the snap.
			 */
			async fetchAccountMosaics(accountIds) {
				const accounts = await this.invokeSnapMethod('fetchAccountMosaics', {
					accountIds
				});

				return accounts;
			},
			/**
			 * Get accounts from snap MetaMask.
			 * @returns {Promise<Record<string, Account>>} The accounts object returned by the snap.
			 */
			async getAccounts() {
				const accounts = await this.invokeSnapMethod('getAccounts');

				return accounts;
			},
			/**
			 * Get mosaic info from snap MetaMask.
			 * @returns {object} The mosaic info object returned by the snap.
			 */
			async getMosaicInfo() {
				const mosaicInfo = await this.invokeSnapMethod('getMosaicInfo');

				return mosaicInfo;
			},
			async fetchAccountTransactions(address, offsetId, group = TransactionGroup.confirmed) {
				const transactions = await this.invokeSnapMethod('fetchAccountTransactions', {
					address,
					offsetId,
					group
				});

				return transactions;
			},
			/**
			 * Get the fee multiplier from snap MetaMask.
			 * @returns {Promise<FeeMultiplier>} The fee multiplier object returned by the snap.
			 */
			async getFeeMultiplier() {
				const feeMultiplier = await this.invokeSnapMethod('getFeeMultiplier');

				return feeMultiplier;
			},
			/**
			 * Sign and announce a transfer transaction in snap MetaMask.
			 * @param {TransferTransactionParams} params - The parameters to sign the transaction.
			 * @returns {string | boolean} The transaction hash.
			 */
			async signTransferTransaction({ accountId, recipient, mosaics, message, fees }) {
				const transactionHash = await this.invokeSnapMethod('signTransferTransaction', {
					accountId,
					recipient,
					mosaics,
					message,
					fees
				});

				return transactionHash;
			},
			/**
			 * Rename account label in snap MetaMask.
			 * @param {string} accountId - The account id.
			 * @param {string} newLabel - The new label for the account.
			 * @returns {Promise<Account>} The updated account object.
			 */
			async renameAccountLabel(accountId, newLabel) {
				const updatedAccount = await this.invokeSnapMethod('renameAccountLabel', {
					accountId,
					newLabel
				});

				return updatedAccount;
			}
		};
	}
};

export default symbolSnapFactory;

// region type declarations

/**
 * Network name.
 * @typedef {'mainnet' | 'testnet'} NetworkName
 */

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
 * Currency price.
 * @typedef {number} Currency
 * @property {string} symbol - The currency symbol.
 * @property {number} price - The currency price.
 */

/**
 * Fee multiplier.
 * @typedef {object} FeeMultiplier
 * @property {number} slow - The slow fee multiplier.
 * @property {number} average - The average fee multiplier.
 * @property {number} fast - The fast fee multiplier.
 */

/**
 * Sign transfer transaction request parameters.
 * @typedef {object} TransferTransactionParams
 * @property {string} accountId - The account id from snap.
 * @property {string} recipient - The accounts address.
 * @property {Array<{mosaicId: string, amount: number}>} mosaics - An array of mosaic objects, each containing a mosaic ID and amount.
 * @property {string} message - The message.
 * @property {'slow' | 'average' | 'fast'} feeMultiplierType - The fee multiplier key.
 */

// endregion
