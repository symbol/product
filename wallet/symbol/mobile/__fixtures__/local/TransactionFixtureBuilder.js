import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';

const DEFAULT_SIGNER = AccountFixtureBuilder
	.createWithAccount('symbol', 'testnet', 0)
	.build();

const EMPTY_FIXTURE = {
	type: 0,
	deadline: {
		timestamp: 0,
		adjusted: 0
	},
	timestamp: 0,
	height: 0,
	hash: '',
	fee: null,
	signerAddress: '',
	signerPublicKey: ''
};

const DEFAULT_FIXTURE = {
	type: 0,
	deadline: {
		timestamp: 1684272488509,
		adjusted: 17022021509
	},
	timestamp: 1684265310994,
	height: 444444,
	hash: '0C905EB065E6A42029CD1A10E710422761495A63D433535BA6EAA9BCF36AB8B6',
	fee: {
		token: TokenFixtureBuilder.createWithToken('symbol', 'testnet', 0)
			.setAmount('0.15')
			.build()
	},
	signerPublicKey: DEFAULT_SIGNER.publicKey,
	signerAddress: DEFAULT_SIGNER.address
};

export class TransactionFixtureBuilder {
	_data = {};

	/**
     * Creates a transaction fixture with the provided data.
     * 
     * @param {object} data - transaction data.
     */
	constructor(data) {
		this._data = { ...data };
	}

	/**
     * Creates an empty transaction fixture.
     * 
     * @returns {TransactionFixtureBuilder}
     */
	static createEmpty = () => {
		return new TransactionFixtureBuilder(EMPTY_FIXTURE);
	};

	/**
     * Creates a transaction fixture with default data.
     * Uses AccountFixtureBuilder to populate signer information.
     * 
     * @param {string} [chainName='symbol'] - chain name.
     * @param {'mainnet' | 'testnet'} [networkIdentifier='testnet'] - network identifier.
     * @returns {TransactionFixtureBuilder}
     */
	static createDefault = (chainName = 'symbol', networkIdentifier = 'testnet') => {
		const signer = AccountFixtureBuilder
			.createWithAccount(chainName, networkIdentifier, 0)
			.build();

		return new TransactionFixtureBuilder({
			...DEFAULT_FIXTURE,
			signerAddress: signer.address,
			signerPublicKey: signer.publicKey
		});
	};

	/**
     * Creates a transaction fixture with the provided data.
     * 
     * @param {object} data - transaction data.
     * @returns {TransactionFixtureBuilder}
     */
	static createWithData = data => {
		return new TransactionFixtureBuilder({
			...DEFAULT_FIXTURE,
			...data
		});
	};

	/**
     * Gets the built transaction data.
     * 
     * @returns {object}
     */
	build() {
		return { ...this._data };
	};

	/**
     * Overrides the transaction data with the provided data.
     * 
     * @param {object} data - The data to override.
     * @returns {TransactionFixtureBuilder} The builder instance.
     */
	override = data => {
		this._data = { ...this._data, ...data };

		return this;
	};

	/**
     * Sets the transaction type.
     * 
     * @param {number} type - The transaction type.
     * @returns {TransactionFixtureBuilder} The builder instance.
     */
	setType = type => {
		this._data.type = type;

		return this;
	};

	/**
     * Sets the deadline for the transaction.
     * 
     * @param {number} deadline - The transaction deadline.
     * @returns {TransactionFixtureBuilder} The builder instance.
     */
	setDeadline = deadline => {
		this._data.deadline = deadline;

		return this;
	};

	/**
     * Sets the timestamp for the transaction.
     * 
     * @param {number} timestamp - The transaction timestamp.
     * @returns {TransactionFixtureBuilder} The builder instance.
     */
	setTimestamp = timestamp => {
		this._data.timestamp = timestamp;

		return this;
	};

	/**
     * Sets the block height for the transaction.
     * 
     * @param {number} height - The block height.
     * @returns {TransactionFixtureBuilder} The builder instance.
     */
	setHeight = height => {
		this._data.height = height;

		return this;
	};

	/**
     * Sets the hash for the transaction.
     * 
     * @param {string} hash - The transaction hash.
     * @returns {TransactionFixtureBuilder} The builder instance.
     */
	setHash = hash => {
		this._data.hash = hash;

		return this;
	};

	/**
     * Sets the fee for the transaction.
     * 
     * @param {number} fee - The transaction fee.
     * @returns {TransactionFixtureBuilder} The builder instance.
     */
	setFee = fee => {
		this._data.fee = fee;

		return this;
	};

	/**
     * Sets the signer address for the transaction.
     * 
     * @param {string} signerAddress - The signer address.
     * @returns {TransactionFixtureBuilder} The builder instance.
     */
	setSignerAddress = signerAddress => {
		this._data.signerAddress = signerAddress;

		return this;
	};

	/**
     * Sets the signer public key for the transaction.
     * 
     * @param {string} signerPublicKey - The signer public key.
     * @returns {TransactionFixtureBuilder} The builder instance.
     */
	setSignerPublicKey = signerPublicKey => {
		this._data.signerPublicKey = signerPublicKey;

		return this;
	};

	/**
     * Sets both signer address and public key from an account object.
     * 
     * @param {object} account - Account with address and publicKey fields.
     * @param {string} account.address - The signer address.
     * @param {string} account.publicKey - The signer public key.
     * @returns {TransactionFixtureBuilder} The builder instance.
     */
	setSigner = account => {
		this._data.signerAddress = account.address;
		this._data.signerPublicKey = account.publicKey;

		return this;
	};
}
