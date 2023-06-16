import { config } from '../config/index.js';
import createSymbolClient from '../services/symbolClient.js';
import helper from '../utils/helper.js';
import symbolSdk from 'symbol-sdk';

const { PrivateKey, facade, symbol } = symbolSdk;

const symbolFacade = {
	facade: new facade.SymbolFacade(config.network),
	faucetKeyPair: new facade.SymbolFacade.KeyPair(new PrivateKey(config.symbol.faucetPrivateKey)),
	client: createSymbolClient(config.symbol),

	/**
	 * Check on network address.
	 * @param {string} address address string.
	 * @returns {boolean} result of address validation.
	 */
	isValidAddress(address) {
		return this.facade.network.isValidAddressString(address);
	},

	/**
	 * Get faucet address.
	 * @returns {string} address.
	 */
	faucetAddress() {
		return this.facade.network.publicKeyToAddress(this.faucetKeyPair.publicKey).toString();
	},

	/**
	 * Get config information.
	 * @returns {object} config object.
	 */
	config() {
		return {
			faucetAddress: this.faucetAddress(),
			currency: 'XYM',
			sendOutMaxAmount: config.sendOutMaxAmount,
			mosaicDivisibility: config.mosaicDivisibility,
			minFollowers: config.minFollowers,
			minAccountAge: config.minAccountAge
		};
	},

	/**
	 * Transfer amount of XYM to specified address
	 * @param {number} amount XYM amount in absolute value.
	 * @param {string} recipientAddress Account address.
	 * @returns {Promise<string>} transaction hash
	 */
	async transfer(amount, recipientAddress) {
		const [
			currencyMosaicId,
			networkTimestamp
		] = await Promise.all([
			this.getCurrencyMosaicId(),
			this.getNetworkTimestamp()
		]);

		const mosaics = [{
			mosaicId: BigInt(`0x${currencyMosaicId}`),
			amount: BigInt(amount)
		}];

		const transferTransaction = this.facade.transactionFactory.create({
			type: 'transfer_transaction_v1',
			fee: BigInt(100000),
			signerPublicKey: this.faucetKeyPair.publicKey,
			recipientAddress,
			mosaics,
			message: [0, ...(new TextEncoder('utf-8')).encode('Good Luck!')],
			deadline: new symbol.NetworkTimestamp(networkTimestamp).addHours(2).timestamp
		});

		const { payload, transactionHash } = helper.signTransaction(this.facade, this.faucetKeyPair, transferTransaction);

		await this.client.announceTransaction(payload);

		return transactionHash;
	},

	/**
	 * Get account balance.
	 * @param {string} address account address.
	 * @returns {Promise<number>} account balance.
	 */
	async getAccountBalance(address) {
		const [currencyMosaicId, { response }] = await Promise.all([
			this.getCurrencyMosaicId(),
			this.client.getAccountInfo(address)
		]);

		let balance = 0;

		// Handle when account is new to network
		if ('ResourceNotFound' !== response.data.code) {
			const result = response.data.account.mosaics.find(mosaic => currencyMosaicId === mosaic.id);
			balance = result ? Number(result.amount) : 0;
		}

		return balance;
	},

	/**
	 * Get number of unconfirmed Transactions
	 * @param {string} address account address.
	 * @returns {Promise<number>} no of unconfirmed transactions.
	 */
	async getUnconfirmedTransactionsCount(address) {
		const { response } = await this.client.getUnconfirmedTransferTransactions(address);

		return response.data.data.length;
	},

	/**
	 * Get network currency mosaicId.
	 * @returns {Promise<string>} network currency MosaicId.
	 */
	async getCurrencyMosaicId() {
		const { response } = await this.client.getNetworkProperties();

		return response.data.chain.currencyMosaicId.slice(2).replace(/'/g, '');
	},

	/**
	 * Get network timestamp.
	 * @returns {Promise<bigint>} send timestamp.
	 */
	async getNetworkTimestamp() {
		const { response } = await this.client.getNetworkTime();

		return BigInt(response.data.communicationTimestamps.sendTimestamp);
	}
};

export default symbolFacade;
