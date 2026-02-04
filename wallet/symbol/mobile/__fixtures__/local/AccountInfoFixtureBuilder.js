const LINKED_KEYS = {
	linkedPublicKey: '67599EEC06BE291E8608E3475D36E4C520389D6C853EA223CF9D744B47A4F630',
	nodePublicKey: 'E4EAF960E8C4291AF1810F706E16750E3790237FDCF8887B4B0C1854603AD0FF',
	vrfPublicKey: '7A79C5CAEFDBCC0C98971312357740E8F300F2E012F97AB75FA2F2DDD2C3F627'
};

const EMPTY_FIXTURE = {
	address: '',
	publicKey: '',
	mosaics: [],
	balance: '0',
	importance: 0,
	linkedKeys: null,
	namespaces: [],
	isMultisig: false,
	cosignatories: [],
	multisigAddresses: []
};

/**
 * @typedef {Object} AccountInfo
 * @property {string} address - Account address.
 * @property {string} publicKey - Account public key.
 * @property {string} balance - Account balance as a string.
 * @property {number} importance - Account importance score.
 * @property {Object|null} linkedKeys - Linked keys information or null if no keys are linked.
 * @property {Array} namespaces - List of namespaces owned by the account.
 * @property {boolean} isMultisig - Indicates if the account is a multisig account.
 * @property {Array} cosignatories - List of cosignatory addresses if the account is multisig.
 * @property {Array} multisigAddresses - List of multisig account addresses this account is a cosignatory of.
 */

export class AccountInfoFixtureBuilder {
	_data = {};
	_chainName = '';
	_networkIdentifier = '';

	/**
	 * Creates an account info fixture with the provided data.
	 * 
	 * @param {AccountInfo} data - account data.
	 * @param {string} [chainName] - chain name the account belongs to.
	 * @param {'mainnet' | 'testnet'} [networkIdentifier] - network identifier the account belongs to.
	 */
	constructor(data, chainName, networkIdentifier) {
		this._data = { ...data };
		this._chainName = chainName;
		this._networkIdentifier = networkIdentifier;
	}

	/**
	 * Creates an empty account info fixture.
	 * 
	 * @returns {AccountInfoFixtureBuilder}
	 */
	static createEmpty = (chainName, networkIdentifier) => {
		return new AccountInfoFixtureBuilder(EMPTY_FIXTURE, chainName, networkIdentifier);
	};

	/**
	 * Creates an account info fixture with default data for the specified chain and network.
	 * Used data from the fixture list.
	 * 
	 * @param {string} chainName - chain name the account belongs to.
	 * @param {'mainnet' | 'testnet'} networkIdentifier - network identifier the account belongs to.
	 * @param {number} index - account item index in the fixture list (eg. 0, 1, 2, ...).
	 * @returns {AccountInfoFixtureBuilder}
	 */
	static createWithAccount = (chainName, networkIdentifier, index) => {
		const account = walletStorageAccounts[chainName][networkIdentifier][index];

		if (!account)
			throw new Error(`Account fixture not found for chain=${chainName}, network=${networkIdentifier}, index=${index}`);

		return new AccountInfoFixtureBuilder({
			...EMPTY_FIXTURE,
			address: account.address,
			publicKey: account.publicKey
		});
	};

	/**
	 * Creates an account info fixture with the provided data.
	 * 
	 * @param {AccountInfo} data - account data.
	 * @returns {AccountInfoFixtureBuilder}
	 * @param {string} [chainName] - chain name the account belongs to.
	 * @param {'mainnet' | 'testnet'} [networkIdentifier] - network identifier the account belongs to.
	 */
	static createWithData = (data, chainName, networkIdentifier) => {
		return new AccountInfoFixtureBuilder(data, chainName, networkIdentifier);
	};

	/**
	 * Gets the built account data.
	 * 
	 * @returns {AccountInfo}
	 */
	build() {
		return { ...this._data };
	};

	/**
	 * Overrides the account info data with the provided data.
	 * 
	 * @param {object} data - The data to override.
	 * @returns {AccountInfoFixtureBuilder} The builder instance.
	 */
	override = data => {
		this._data = { ...this._data, ...data };
		
		return this;
	};

	/**
	 * Sets the multisig status and cosignatories based on the provided indexes.
	 * Defines whether the account is multisig or not.
	 * 
	 * @param {boolean} isMultisig - Whether the account is multisig.
	 * @param {number[]} [cosignatoryIndexes=[]] - Indexes of cosignatory accounts.
	 * @returns {AccountInfoFixtureBuilder} The builder instance.
	 */
	setMultisigStatusByIndexes = (isMultisig, cosignatoryIndexes = []) => {
		if (isMultisig) {
			const accounts = walletStorageAccounts[this._chainName][this._networkIdentifier];

			const cosignatories = cosignatoryIndexes.map(index => {
				const account = accounts[index];
				if (!account) {
					throw new Error(`Cosignatory account fixture not found for 
						chain=${this._chainName}, 
						network=${this._networkIdentifier}, 
						index=${index}
					`);
				}

				return account.address;
			});

			this._data.isMultisig = true;
			this._data.cosignatories = cosignatories;
		} else {
			this._data.isMultisig = false;
			this._data.cosignatories = [];
		}

		return this;
	};

	/**
	 * Sets the multisig account addresses based on the provided indexes.
	 * Defines whether the account is a cosignatory of other multisig accounts.
	 * 
	 * @param {number[]} multisigAccountIndexes - Indexes of multisig accounts.
	 * @returns {AccountInfoFixtureBuilder} The builder instance.
	 */
	setMultisigAccountsByIndexes = multisigAccountIndexes => {
		const accounts = walletStorageAccounts[this._chainName][this._networkIdentifier];

		const multisigAddresses = multisigAccountIndexes.map(index => {
			const account = accounts[index];
			if (!account) {
				throw new Error(`Multisig account fixture not found for 
					chain=${this._chainName}, 
					network=${this._networkIdentifier}, 
					index=${index}
				`);
			}

			return account.address;
		});

		this._data.multisigAddresses = multisigAddresses;

		return this;
	};

	/**
	 * Sets the linked keys based on the provided boolean flags.
	 * 
	 * @param {boolean} isLinkedPublicKeyLinked - Whether the linked public key is linked.
	 * @param {boolean} isNodePublicKeyLinked - Whether the node public key is linked.
	 * @param {boolean} isVrfPublicKeyLinked - Whether the VRF public key is linked.
	 * @returns {AccountInfoFixtureBuilder} The builder instance.
	 */
	setLinkedKeys = (isLinkedPublicKeyLinked, isNodePublicKeyLinked, isVrfPublicKeyLinked) => {
		if (!isLinkedPublicKeyLinked && !isNodePublicKeyLinked && !isVrfPublicKeyLinked) {
			this._data.linkedKeys = null;
			
			return this;
		}
		
		this._data.linkedKeys = {
			linkedPublicKey: isLinkedPublicKeyLinked ? LINKED_KEYS.linkedPublicKey : null,
			nodePublicKey: isNodePublicKeyLinked ? LINKED_KEYS.nodePublicKey : null,
			vrfPublicKey: isVrfPublicKeyLinked ? LINKED_KEYS.vrfPublicKey : null
		};

		return this;
	};

	/**
	 * Sets the balance for the account.
	 * 
	 * @param {string} balance - The account balance.
	 * @returns {AccountInfoFixtureBuilder} The builder instance.
	 */
	setBalance = balance => {
		this._data.balance = balance;
		
		return this;
	};

	/**
	 * Sets the importance for the account.
	 * 
	 * @param {number} importance - The account importance.
	 * @returns {AccountInfoFixtureBuilder} The builder instance.
	 */
	setImportance = importance => {
		this._data.importance = importance;
		
		return this;
	};
}
