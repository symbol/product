import { config } from '../config/index.js';
import createNemClient from '../services/nemClient.js';
import helper from '../utils/helper.js';
import { PrivateKey } from 'symbol-sdk';
import { NemFacade, NetworkTimestamp } from 'symbol-sdk/nem';

const nemFacade = {
	facade: new NemFacade(config.network),
	faucetKeyPair: new NemFacade.KeyPair(new PrivateKey(config.nem.faucetPrivateKey)),
	client: createNemClient(config.nem),

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
			currency: 'XEM',
			sendOutMaxAmount: config.sendOutMaxAmount,
			mosaicDivisibility: config.mosaicDivisibility,
			minFollowers: config.minFollowers,
			minAccountAge: config.minAccountAge
		};
	},

	/**
	 * Transfer amount of XEM to specified address
	 * @param {number} amount XEM amount in absolute value.
	 * @param {string} recipientAddress Account address.
	 * @returns {Promise<string>} transaction hash
	 */
	async transfer(amount, recipientAddress) {
		const timestamp = await nemFacade.getNetworkTimestamp();

		const networkTimestamp = new NetworkTimestamp(timestamp);

		const transferTransaction = this.facade.transactionFactory.create({
			type: 'transfer_transaction_v1',
			fee: BigInt(100000),
			signerPublicKey: this.faucetKeyPair.publicKey,
			recipientAddress,
			timestamp: Number(networkTimestamp.timestamp),
			deadline: Number(networkTimestamp.addHours(1).timestamp),
			amount: BigInt(amount),
			message: {
				messageType: 'plain',
				message: 'Good Luck!'
			}
		});

		const { payload } = helper.signTransaction(this.facade, this.faucetKeyPair, transferTransaction);

		const { response: result } = await this.client.announceTransaction(payload);

		return result.data.transactionHash.data;
	},

	/**
	 * Get account balance.
	 * @param {string} address account address.
	 * @returns {Promise<number>} account balance.
	 */
	async getAccountBalance(address) {
		const { response } = await this.client.getAccountInfo(address);

		return response.data.account.balance;
	},

	/**
	 * Get no of unconfirmed transactions.
	 * @param {string} address account address.
	 * @returns {Promise<number>} no of unconfirmed transactions.
	 */
	async getUnconfirmedTransactionsCount(address) {
		const { response } = await this.client.getUnconfirmedTransactions(address);

		return response.data.data.filter(item => item.transaction.recipient === address).length;
	},

	/**
	 * Get network timestamp.
	 * @returns {Promise<number>} send timestamp.
	 */
	async getNetworkTimestamp() {
		const { response } = await this.client.getNetworkTime();

		return Math.floor(response.data.sendTimeStamp / 1000);
	}
};

export default nemFacade;
