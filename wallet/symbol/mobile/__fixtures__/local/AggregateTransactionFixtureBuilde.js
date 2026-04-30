import { TransactionFixtureBuilder } from '__fixtures__/local/TransactionFixtureBuilder';
import { TransactionType } from 'wallet-common-symbol/src/constants';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */

const EMPTY_AGGREGATE_FIXTURE = {
	type: TransactionType.AGGREGATE_COMPLETE,
	amount: '0',
	innerTransactions: [],
	cosignatures: [],
	receivedCosignatures: [],
	fee: null
};

export class AggregateTransactionFixtureBuilder extends TransactionFixtureBuilder {
	/**
	 * Creates an aggregate transaction fixture.
	 *
	 * @param {object} data - Combined base + aggregate data.
	 */
	constructor(data) {
		super(data);
	}

	/**
	 * Creates an empty aggregate transaction fixture.
	 *
	 * @returns {AggregateTransactionFixtureBuilder}
	 */
	static createEmpty = () => {
		const base = TransactionFixtureBuilder
			.createEmpty()
			.build();

		return new AggregateTransactionFixtureBuilder({
			...base,
			...EMPTY_AGGREGATE_FIXTURE
		});
	};

	/**
	 * Creates a default AGGREGATE_COMPLETE transaction fixture.
	 *
	 * @param {string} [chainName='symbol'] - Chain name.
	 * @param {'mainnet' | 'testnet'} [networkIdentifier='testnet'] - Network identifier.
	 * @returns {AggregateTransactionFixtureBuilder}
	 */
	static createDefaultComplete = (chainName = 'symbol', networkIdentifier = 'testnet') => {
		const base = TransactionFixtureBuilder
			.createDefault(chainName, networkIdentifier)
			.setType(TransactionType.AGGREGATE_COMPLETE)
			.build();

		return new AggregateTransactionFixtureBuilder({
			...base,
			amount: '0',
			innerTransactions: [],
			cosignatures: [],
			receivedCosignatures: []
		});
	};

	/**
	 * Creates a default AGGREGATE_BONDED transaction fixture.
	 *
	 * @param {string} [chainName='symbol'] - Chain name.
	 * @param {'mainnet' | 'testnet'} [networkIdentifier='testnet'] - Network identifier.
	 * @returns {AggregateTransactionFixtureBuilder}
	 */
	static createDefaultBonded = (chainName = 'symbol', networkIdentifier = 'testnet') => {
		const base = TransactionFixtureBuilder
			.createDefault(chainName, networkIdentifier)
			.setType(TransactionType.AGGREGATE_BONDED)
			.build();

		return new AggregateTransactionFixtureBuilder({
			...base,
			amount: '0',
			innerTransactions: [],
			cosignatures: [],
			receivedCosignatures: []
		});
	};

	/**
	 * Creates an aggregate transaction fixture with the provided data.
	 *
	 * @param {object} data - Full transaction data.
	 * @returns {AggregateTransactionFixtureBuilder}
	 */
	static createWithData = data => {
		return new AggregateTransactionFixtureBuilder({
			...EMPTY_AGGREGATE_FIXTURE,
			...data
		});
	};

	/**
	 * Sets the inner transactions for the aggregate.
	 *
	 * @param {Array<Transaction>} innerTransactions - Array of inner transaction objects.
	 * @returns {AggregateTransactionFixtureBuilder} The builder instance.
	 */
	setInnerTransactions = innerTransactions => {
		this._data.innerTransactions = innerTransactions;

		return this;
	};

	/**
	 * Adds an inner transaction to the aggregate.
	 *
	 * @param {object} transaction - Inner transaction object.
	 * @returns {AggregateTransactionFixtureBuilder} The builder instance.
	 */
	addInnerTransaction = transaction => {
		this._data.innerTransactions = [
			...this._data.innerTransactions,
			transaction
		];

		return this;
	};

	/**
	 * Adds a cosignature from a wallet account.
	 * Updates both cosignatures and receivedCosignatures fields.
	 *
	 * @param {import('wallet-common-core/src/types/Account').WalletAccount} account - The cosigner account with publicKey and address.
	 * @param {string} [signature=''] - The cosignature signature hex string.
	 * @param {number} [version=0] - The cosignature version.
	 * @returns {AggregateTransactionFixtureBuilder} The builder instance.
	 */
	addCosignature = (account, signature = '', version = 0) => {
		this._data.cosignatures = [
			...this._data.cosignatures,
			{
				signerPublicKey: account.publicKey,
				signature,
				version
			}
		];
		this._data.receivedCosignatures = [
			...this._data.receivedCosignatures,
			account.address
		];

		return this;
	};

	/**
	 * Sets all cosignatures from an array of wallet accounts.
	 * Replaces both cosignatures and receivedCosignatures fields.
	 *
	 * @param {Array<{
	 * 	account: import('wallet-common-core/src/types/Account').WalletAccount, 
	 * 	signature?: string, 
	 * 	version?: number
	 * }>} cosigners - Array of objects with account, optional signature, and optional version.
	 * @returns {AggregateTransactionFixtureBuilder} The builder instance.
	 */
	setCosignatures = cosigners => {
		this._data.cosignatures = cosigners.map(({ account, signature = '', version = 0 }) => ({
			signerPublicKey: account.publicKey,
			signature,
			version
		}));
		this._data.receivedCosignatures = cosigners.map(({ account }) => account.address);

		return this;
	};

	/**
	 * Sets the amount for the aggregate transaction.
	 *
	 * @param {string} amount - The aggregate amount.
	 * @returns {AggregateTransactionFixtureBuilder} The builder instance.
	 */
	setAmount = amount => {
		this._data.amount = amount;

		return this;
	};
}
