import { 
	EMPTY_AGGREGATE_HASH, 
	HASH_LOCK_AMOUNT, 
	HASH_LOCK_DURATION,
	MULTISIG_TRANSACTION_DEADLINE_HOURS,
	SINGLE_TRANSACTION_DEADLINE_HOURS,
	TransactionBundleType,
	TransactionType
} from '../constants';
import { createDeadline, createTransactionFee } from '../utils';
import { PersistentStorageRepository, TransactionBundle, cloneNetworkObjectMap, createNetworkMap } from 'wallet-common-core';

/** @typedef {import('../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../types/Account').PrivateAccount} PrivateAccount */
/** @typedef {import('../types/Account').AccountInfo} AccountInfo */
/** @typedef {import('../types/Transaction').Transaction} Transaction */

const createDefaultState = networkIdentifiers => ({
	multisigAccounts: createNetworkMap(() => ({}), networkIdentifiers)
});

export class MultisigModule {
	static name = 'multisig';
	#walletController;
	#api;
	#networkIdentifiers;
	#onStateChange;
	_persistentStorageRepository;
	_state;

	constructor() { }

	/**
	 * Initializes the module with the wallet controller and API.
	 * @param {Object} options - The initialization options.
	 * @param {Object} options.walletController - The wallet controller instance.
	 * @param {Object} options.api - The API instance for network calls.
	 * @param {Object} options.persistentStorageInterface - The persistent storage interface.
	 * @param {string[]} options.networkIdentifiers - Array of network identifiers.
	 * @param {Function} [options.onStateChange] - Callback for state changes.
	 */
	init = options => {
		this.#walletController = options.walletController;
		this.#api = options.api;
		this.#networkIdentifiers = options.networkIdentifiers;
		this.#onStateChange = options.onStateChange;
		this._persistentStorageRepository = new PersistentStorageRepository(options.persistentStorageInterface);
		this._state = createDefaultState(options.networkIdentifiers);
	};

	/**
	 * Loads cached multisig accounts from persistent storage.
	 * @returns {Promise<void>} A promise that resolves when the cache is loaded.
	 */
	loadCache = async () => {
		const multisigAccounts = await this.#loadMultisigAccounts();

		this.resetState();

		this.#setState(() => {
			this._state.multisigAccounts = multisigAccounts;
		});
	};

	/**
	 * Resets the module state to default values.
	 */
	resetState = () => {
		this._state = createDefaultState(this.#networkIdentifiers);
	};

	/**
	 * Clears the module state.
	 */
	clear = () => {
		this.resetState();
	};

	#setState = callback => {
		callback.bind(this);
		callback();

		this.#onStateChange?.();
	};

	/**
	 * Gets the multisig accounts for the current account on the current network.
	 * @returns {AccountInfo[]} The list of multisig accounts.
	 */
	get multisigAccounts() {
		const { networkIdentifier, currentAccount } = this.#walletController;
		const networkMultisigAccounts = this._state.multisigAccounts[networkIdentifier];

		return networkMultisigAccounts[currentAccount.address] || [];
	}

	/**
	 * Gets a multisig account by its address.
	 * @param {string} address - The address of the multisig account.
	 * @returns {AccountInfo|null} The multisig account or null if not found.
	 */
	getMultisigAccountByAddress = address => {
		return this.multisigAccounts.find(account => account.address === address) || null;
	};

	/**
	 * Fetches the current account's multisig account info list.
	 * Stores data in persistent storage cache and updates the state.
	 * @returns {Promise<AccountInfo[]>} The list of multisig accounts.
	 */
	fetchData = async () => {
		const { currentAccount, networkProperties, networkIdentifier } = this.#walletController;
		const currentAccountAddress = currentAccount.address;
		const currentAccountInfo = await this.#api.account.fetchAccountInfo(networkProperties, currentAccountAddress);

		if (!currentAccountInfo.multisigAddresses || currentAccountInfo.multisigAddresses.length === 0) {
			await this.#updateCachedMultisigAccounts([], networkIdentifier, currentAccountAddress);
			
			return [];
		}

		const multisigAccountInfos = await Promise.all(currentAccountInfo.multisigAddresses.map(address =>
			this.#api.account.fetchAccountInfo(networkProperties, address)));

		await this.#updateCachedMultisigAccounts(multisigAccountInfos, networkIdentifier, currentAccountAddress);

		return multisigAccountInfos;
	};

	/**
	 * Fetches account info for a given address.
	 * @param {string} address - The address to fetch account info for.
	 * @returns {Promise<AccountInfo>} The account info.
	 */
	fetchAccountInfo = async address => {
		const { networkProperties } = this.#walletController;
		return await this.#api.account.fetchAccountInfo(networkProperties, address);
	};

	/**
	 * Creates a multisig account modification transaction for converting account into multisig or
	 * for modifying an existing multisig account.
	 * When creating a new multisig account, make sure multisigAccount has a private key. 
	 * The signature of this account is required to convert it into a multisig account.
	 * When modifying an existing multisig account, the multisigAccount can be a public account 
	 * and not contain the private key, as the transaction will be only signed by 
	 * the current account and other cosignatories of the multisig account.
	 * @param {Object} options - The transaction options.
	 * @param {PublicAccount|PrivateAccount} options.multisigAccount - The account of the account to modify.
	 * @param {string[]} options.addressAdditions - List of cosignatories to add.
	 * @param {string[]} options.addressDeletions - List of cosignatories to remove.
	 * @param {number} options.minApprovalDelta - The change in minimum approvals required for transactions.
	 * @param {number} options.minRemovalDelta - The change in minimum approvals required for cosignatory removal.
	 * @returns {TransactionBundle} The transaction bundle containing hash lock and aggregate bonded transactions.
	 */
	createTransaction = options => {
		const { multisigAccount, addressAdditions, addressDeletions, minApprovalDelta, minRemovalDelta } = options;

		const multisigModificationTransaction = {
			type: TransactionType.MULTISIG_ACCOUNT_MODIFICATION,
			signerPublicKey: multisigAccount.publicKey,
			signerAddress: multisigAccount.address,
			minApprovalDelta,
			minRemovalDelta,
			addressAdditions,
			addressDeletions
		};

		return this.#createAggregateBondedBundle(multisigModificationTransaction, multisigAccount.privateKey);
	};

	/**
	 * @typedef {Object} MultisigAccountModificationDeltas
	 * @property {string[]} addressAdditions - List of cosignatory addresses to be added.
	 * @property {string[]} addressDeletions - List of cosignatory addresses to be removed.
	 * @property {number} minApprovalDelta - The change in minimum approvals required for transactions.
	 * @property {number} minRemovalDelta - The change in minimum approvals required for cosignatory removal.
	 */

	/**
	 * Calculates the deltas for cosignatory additions/removals and min approval/removal changes
	 * based on current multisig account info and updated values.
	 * @param {Object} options - The options for delta calculation.
	 * @param {AccountInfo} options.multisigAccountInfo - The current multisig account information.
	 * @param {Object} options.updatedValues - The updated values for cosignatories and min approval/removal.
	 * @param {string[]} options.updatedValues.cosignatories - The updated list of cosignatory addresses.
	 * @param {number} options.updatedValues.minApproval - The updated minimum number of cosignatories required for transaction approval.
	 * @param {number} options.updatedValues.minRemoval - The updated minimum number of cosignatories required for cosignatory removal.
	 * @returns {MultisigAccountModificationDeltas} The calculated deltas.
	 */
	calculateDeltas = options => {
		const { multisigAccountInfo, updatedValues } = options;

		const currentCosignatoryAddresses = multisigAccountInfo.cosignatories;
		const newCosignatoryAddresses = updatedValues.cosignatories;

		// Calculate address additions and deletions
		const addressAdditions = newCosignatoryAddresses.filter(address => !currentCosignatoryAddresses.includes(address));
		const addressDeletions = currentCosignatoryAddresses.filter(address => !newCosignatoryAddresses.includes(address));

		// Calculate min approval and removal deltas
		const minApprovalDelta = updatedValues.minApproval - multisigAccountInfo.minApproval;
		const minRemovalDelta = updatedValues.minRemoval - multisigAccountInfo.minRemoval;

		return {
			addressAdditions,
			addressDeletions,
			minApprovalDelta,
			minRemovalDelta
		};
	};

	/**
	 * Creates an aggregate bonded transaction bundle with hash lock.
	 * @param {Transaction} innerTransaction - The inner transaction.
	 * @param {string} [multisigAccountPrivateKey] - Optional private key of the multisig account.
	 * If provided, will be used to cosign the aggregate bonded transaction.
	 * @returns {TransactionBundle} The transaction bundle.
	 */
	#createAggregateBondedBundle = (innerTransaction, multisigAccountPrivateKey) => {
		const { currentAccount, networkProperties } = this.#walletController;
		const defaultFee = createTransactionFee(networkProperties, '0');

		const hashLockTransaction = {
			type: TransactionType.HASH_LOCK,
			signerPublicKey: currentAccount.publicKey,
			mosaic: {
				id: networkProperties.networkCurrency.mosaicId,
				amount: HASH_LOCK_AMOUNT,
				divisibility: networkProperties.networkCurrency.divisibility
			},
			lockedAmount: HASH_LOCK_AMOUNT,
			duration: HASH_LOCK_DURATION,
			fee: defaultFee,
			deadline: createDeadline(SINGLE_TRANSACTION_DEADLINE_HOURS, networkProperties.epochAdjustment),
			aggregateHash: EMPTY_AGGREGATE_HASH
		};

		const aggregateBondedTransaction = {
			type: TransactionType.AGGREGATE_BONDED,
			innerTransactions: [innerTransaction],
			signerPublicKey: currentAccount.publicKey,
			signerAddress: currentAccount.address,
			fee: defaultFee,
			deadline: createDeadline(MULTISIG_TRANSACTION_DEADLINE_HOURS, networkProperties.epochAdjustment)
		};

		return new TransactionBundle(
			[hashLockTransaction, aggregateBondedTransaction],
			{ 
				type: TransactionBundleType.MULTISIG_ACCOUNT_MODIFICATION,
				cosignaturePrivateKeys: multisigAccountPrivateKey ? [multisigAccountPrivateKey] : []
			}
		);
	};

	/**
	 * Updates the cached multisig accounts for a specific wallet account.
	 * @param {AccountInfo[]} multisigAccounts - The multisig accounts to cache.
	 * @param {string} networkIdentifier - The network identifier for which to update the cache.
	 * @param {string} currentAccountAddress - The address of the current wallet account.
	 * @returns {Promise<void>}
	 */
	#updateCachedMultisigAccounts = async (multisigAccounts, networkIdentifier, currentAccountAddress) => {
		const allMultisigAccounts = await this.#loadMultisigAccounts();

		if (!allMultisigAccounts[networkIdentifier])
			allMultisigAccounts[networkIdentifier] = {};

		allMultisigAccounts[networkIdentifier][currentAccountAddress] = multisigAccounts;

		await this._persistentStorageRepository.setMultisigAccounts(allMultisigAccounts);

		this.#setState(() => {
			this._state.multisigAccounts = allMultisigAccounts;
		});
	};

	/**
	 * Loads multisig accounts from persistent storage.
	 * @returns {Promise<Object>} The multisig accounts map.
	 */
	#loadMultisigAccounts = async () => {
		const multisigAccounts = await this._persistentStorageRepository.getMultisigAccounts();
		const defaultState = createDefaultState(this.#networkIdentifiers);

		return cloneNetworkObjectMap(
			multisigAccounts,
			this.#networkIdentifiers,
			defaultState.multisigAccounts
		);
	};
}
