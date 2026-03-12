import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { TransactionFixtureBuilder } from '__fixtures__/local/TransactionFixtureBuilder';
import { MessageType, TransactionType } from 'wallet-common-symbol/src/constants';

const EMPTY_TRANSFER_FIXTURE = {
	type: TransactionType.TRANSFER,
	recipientAddress: '',
	message: null,
	mosaics: [],
	amount: '0',
	fee: null
};

export class TransferTransactionFixtureBuilder extends TransactionFixtureBuilder {
	/**
	 * Creates a transfer transaction fixture.
	 * 
	 * @param {object} data - combined base + transfer data.
	 */
	constructor(data) {
		super(data);
	}

	/**
	 * Creates an empty transfer transaction fixture.
	 * 
	 * @returns {TransferTransactionFixtureBuilder}
	 */
	static createEmpty = () => {
		const base = TransactionFixtureBuilder
			.createEmpty()
			.build();

		return new TransferTransactionFixtureBuilder({
			...base,
			...EMPTY_TRANSFER_FIXTURE
		});
	};

	/**
	 * Creates a transfer transaction fixture with default data.
	 * Uses AccountFixtureBuilder for signer/recipient and TokenFixtureBuilder for mosaics.
	 * 
	 * @param {string} [chainName='symbol'] - chain name.
	 * @param {'mainnet' | 'testnet'} [networkIdentifier='testnet'] - network identifier.
	 * @returns {TransferTransactionFixtureBuilder}
	 */
	static createDefault = (chainName = 'symbol', networkIdentifier = 'testnet') => {
		const signer = AccountFixtureBuilder
			.createWithAccount(chainName, networkIdentifier, 0)
			.build();
		const recipient = AccountFixtureBuilder
			.createWithAccount(chainName, networkIdentifier, 1)
			.build();
		const token = TokenFixtureBuilder
			.createWithToken(chainName, networkIdentifier, 0)
			.setAmount('123.456')
			.build();

		const base = TransactionFixtureBuilder
			.createDefault(chainName, networkIdentifier)
			.setType(TransactionType.TRANSFER)
			.build();

		return new TransferTransactionFixtureBuilder({
			...base,
			signerAddress: signer.address,
			signerPublicKey: signer.publicKey,
			recipientAddress: recipient.address,
			message: null,
			mosaics: [token],
			amount: `-${token.amount}`
		});
	};

	/**
	 * Creates a transfer transaction fixture with the provided data.
	 * 
	 * @param {object} data - full transaction data.
	 * @returns {TransferTransactionFixtureBuilder}
	 */
	static createWithData = data => {
		return new TransferTransactionFixtureBuilder({
			...EMPTY_TRANSFER_FIXTURE,
			...data
		});
	};

	/**
	 * Sets the recipient address for the transfer.
	 * 
	 * @param {string} recipientAddress - The recipient address.
	 * @returns {TransferTransactionFixtureBuilder} The builder instance.
	 */
	setRecipientAddress = recipientAddress => {
		this._data.recipientAddress = recipientAddress;

		return this;
	};

	/**
	 * Sets the message for the transfer.
	 * 
	 * @param {object|null} message - The message object with { type, text, payload } shape.
	 * @returns {TransferTransactionFixtureBuilder} The builder instance.
	 */
	setMessage = message => {
		this._data.message = message;

		return this;
	};

	/**
	 * Sets a plain text message for the transfer.
	 * 
	 * @param {string} text - The plain text message.
	 * @returns {TransferTransactionFixtureBuilder} The builder instance.
	 */
	setPlainMessage = text => {
		const payload = '00' + Buffer.from(text, 'utf8').toString('hex');

		this._data.message = {
			type: MessageType.PlainText,
			text,
			payload
		};

		return this;
	};

	/**
	 * Sets an encrypted message for the transfer.
	 * 
	 * @param {string} payload - The encrypted message payload (hex string).
	 * @returns {TransferTransactionFixtureBuilder} The builder instance.
	 */
	setEncryptedMessage = payload => {
		this._data.message = {
			type: MessageType.EncryptedText,
			text: null,
			payload
		};

		return this;
	};

	/**
	 * Sets a delegated harvesting message for the transfer.
	 * 
	 * @param {string} payload - The delegated harvesting message payload (hex string).
	 * @returns {TransferTransactionFixtureBuilder} The builder instance.
	 */
	setDelegatedHarvestingMessage = payload => {
		this._data.message = {
			type: MessageType.DelegatedHarvesting,
			text: '',
			payload
		};

		return this;
	};

	/**
	 * Sets the mosaics for the transfer.
	 * 
	 * @param {Array} mosaics - Array of mosaic objects with { id, name, names, divisibility, amount } shape.
	 * @returns {TransferTransactionFixtureBuilder} The builder instance.
	 */
	setMosaics = mosaics => {
		this._data.mosaics = mosaics;

		return this;
	};

	/**
	 * Adds a mosaic to the transfer using a token fixture and amount.
	 * 
	 * @param {object} token - Token object from TokenFixtureBuilder with { id, name, divisibility }.
	 * @param {number} amount - The mosaic amount.
	 * @returns {TransferTransactionFixtureBuilder} The builder instance.
	 */
	addMosaic = (token, amount) => {
		this._data.mosaics = [
			...this._data.mosaics,
			{
				id: token.id,
				name: token.name,
				names: [token.name],
				divisibility: token.divisibility,
				amount
			}
		];

		return this;
	};

	/**
	 * Sets the amount for the transfer.
	 * Negative values indicate outgoing, positive indicate incoming, 0 for self-transfers.
	 * 
	 * @param {number} amount - The transfer amount.
	 * @returns {TransferTransactionFixtureBuilder} The builder instance.
	 */
	setAmount = amount => {
		this._data.amount = amount;

		return this;
	};
}
