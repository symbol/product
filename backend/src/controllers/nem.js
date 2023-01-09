import { config } from '../config/index.js';
import nemRequest from '../services/nemRequest.js';
import symbolSDK from 'symbol-sdk';

const { CryptoTypes, facade } = symbolSDK;

const nemFacade = new facade.NemFacade(config.network);

/**
 * Create signed transfer transaction.
 * @param {string} address Account address.
 * @param {number} timestamp Network timestamp.
 * @param {number} amount XEM amount in absolute value.
 * @returns {object} Signed transaction payload.
 */
const createTransferTransactionV1 = (address, timestamp, amount) => {
	const privateKey = new CryptoTypes.PrivateKey(config.nemFaucetPrivateKey);
	const keyPair = new facade.NemFacade.KeyPair(privateKey);

	const message = 'Good Luck!';

	const transferTransaction = nemFacade.transactionFactory.create({
		type: 'transfer_transaction_v1',
		signerPublicKey: keyPair.publicKey.toString(),
		fee: BigInt(100000),
		timestamp,
		deadline: timestamp + 3600,
		recipientAddress: address,
		amount: BigInt(amount),
		messageEnvelopeSize: message.length + 4 + 4, // 4 bytes for messageType and 4 bytes for messageEnvelopeSize
		message: {
			messageType: 'plain',
			message
		}
	});

	const signature = nemFacade.signTransaction(keyPair, transferTransaction);

	const jsonPayload = nemFacade.transactionFactory.constructor.attachSignature(transferTransaction, signature);

	return JSON.parse(jsonPayload);
};

const nem = {
	/**
	 * Transfer amount of XEM to specified address
	 * @param {number} amount XEM amount in absolute value.
	 * @param {string} address Account address.
	 * @returns {Promise<object>} announce payload
	 */
	transferXem: async (amount, address) => {
		const { response } = await nemRequest.getNetworkTime();

		const timestamp = response.data.sendTimeStamp;

		const networkTimestamp = Math.floor(timestamp / 1000);

		const payload = createTransferTransactionV1(address, networkTimestamp, amount);

		const { response: result } = await nemRequest.announceTransaction(payload);

		return result.data;
	},
	/**
	 * Get account balance.
	 * @param {string} address account address.
	 * @returns {Promise<object>} account balance.
	 */
	getAccountBalance: async address => {
		const { response } = await nemRequest.getAccountInfo(address);

		return {
			address: response.data.account.address,
			balance: response.data.account.balance
		};
	},
	/**
	 * Get unconfirmed transactions.
	 * @param {string} address account address.
	 * @returns {Promise<array>} unconfirmed transactions.
	 */
	getUnconfirmedTransactions: async address => {
		const { response } = await nemRequest.getUnconfirmedTransactions(address);

		return response.data.data;
	}
};

export default nem;
