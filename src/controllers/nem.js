import NemRequest from '../services/nemRequest';
import nemSDK from 'nem-sdk';

/**
 * Create signed transfer transaction.
 * @param {string} address Account address.
 * @param {number} timestamp Network timestamp.
 * @param {number} amount XEM amount in absolute value.
 * @returns {object} Signed transaction payload.
 */
const createTransferTransaction = (address, timestamp, amount) => {
	const keyPair = nemSDK.crypto.keyPair.create(process.env.NEM_FAUCET_PRIVATE_KEY);
	const message = 'Good Luck!';
	const messagePayload = nemSDK.utils.convert.utf8ToHex(message.toString());

	const entity = {
		type: 257, // Transfer Transaction
		version: -1744830463,
		signer: keyPair.publicKey.toString(),
		timeStamp: timestamp,
		deadline: timestamp + 3600, // 1 hour deadline
		recipient: address,
		amount,
		fee: 100000, // 0.1 XEM
		message: { type: 1, payload: messagePayload },
		mosaics: null
	};

	const result = nemSDK.utils.serialization.serializeTransaction(entity);
	const signature = keyPair.sign(result);

	return {
		data: nemSDK.utils.convert.ua2hex(result),
		signature: signature.toString()
	};
};

const Nem = {
	/**
	 * Transfer amount of Xem to specified address
	 * @param {number} amount XEM amount in absolute value.
	 * @param {string} address Account address.
	 * @returns {Promise<object>} announce payload
	 */
	transferXem: async (amount, address) => {
		const { response, error } = await NemRequest.getNetworkTime();

		if (error)
			throw new Error(error.message);

		const timestamp = response.data.sendTimeStamp;

		const networkTimestamp = Math.floor(timestamp / 1000);

		const payload = createTransferTransaction(address, networkTimestamp, amount);

		const { response: result } = await NemRequest.announceTransaction(payload);

		return result.data;
	},
	/**
	 * Get account balance.
	 * @param {string} address account address.
	 * @returns {Promise<object>} account balance.
	 */
	getAccountBalance: async address => {
		const { response, error } = await NemRequest.getAccountInfo(address);

		if (error)
			throw new Error(error.message);

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
		const { response, error } = await NemRequest.getUnconfirmedTransactions(address);

		if (error)
			throw new Error(error.message);

		return response.data.data;
	}
};

export default Nem;
