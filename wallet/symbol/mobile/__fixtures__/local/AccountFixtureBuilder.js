import { walletStorageAccounts } from '__fixtures__/local/wallet';

export class AccountFixtureBuilder {
	_data = {};

	constructor(data) {
		this._data = { ...data };
	}

	/**
	 * Creates an empty account fixture.
	 * 
	 * @returns {AccountFixtureBuilder}
	 */
	static createEmpty = () => {
		return new AccountFixtureBuilder({});
	};

	/**
	 * Creates an account fixture with default data for the specified chain and network.
	 * Used data from the fixture list.
	 * 
	 * @param {string} chainName - chain name the account belongs to.
	 * @param {'mainnet' | 'testnet'} networkIdentifier - network identifier the account belongs to.
	 * @param {number} index - account item index in the fixture list (eg. 0, 1, 2, ...).
	 * @returns {AccountFixtureBuilder}
	 */
	static createWithAccount = (chainName, networkIdentifier, index) => {
		const account = walletStorageAccounts[chainName][networkIdentifier][index];

		if (!account) 
			throw new Error(`Account fixture not found for chain=${chainName}, network=${networkIdentifier}, index=${index}`);
		
		return new AccountFixtureBuilder(account);
	};

	/**
	 * Creates an account fixture with the provided data.
	 * 
	 * @param {import('wallet-common-core/src/types/Account').WalletAccount} data - account data.
	 * @returns {AccountFixtureBuilder}
	 */
	static createWithData = data => {
		return new AccountFixtureBuilder(data);
	};

	/**
	 * Gets the built account data.
	 * 
	 * @returns {import('wallet-common-core/src/types/Account').WalletAccount}
	 */
	build() {
		return { ...this._data };
	};

	/**
	 * Overrides the account data with the provided data.
	 * 
	 * @param {object} data - The data to override.
	 * @returns {AccountFixtureBuilder} The builder instance.
	 */
	override = data => {
		this._data = { ...this._data, ...data };
		
		return this;
	};

	/**
	 * Sets the seed index for the account.
	 * 
	 * @param {number} index - The seed index.
	 * @returns {AccountFixtureBuilder} The builder instance.
	 */
	setSeedIndex = index => {
		this._data.index = index;
		
		return this;
	};

	/**
	 * Sets the account type.
	 * 
	 * @param {string} accountType - The account type.
	 * @returns {AccountFixtureBuilder} The builder instance.
	 */
	setAccountType = accountType => {
		this._data.accountType = accountType;
		
		return this;
	};

	/**
	 * Sets the address for the account.
	 * 
	 * @param {string} address - The account address.
	 * @returns {AccountFixtureBuilder} The builder instance.
	 */
	setAddress = address => {
		this._data.address = address;
		
		return this;
	};

	/**
	 * Sets the public key for the account.
	 * 
	 * @param {string} publicKey - The public key.
	 * @returns {AccountFixtureBuilder} The builder instance.
	 */
	setPublicKey = publicKey => {
		this._data.publicKey = publicKey;
		
		return this;
	};

	/**
	 * Sets the private key for the account.
	 * 
	 * @param {string} privateKey - The private key.
	 * @returns {AccountFixtureBuilder} The builder instance.
	 */
	setPrivateKey = privateKey => {
		this._data.privateKey = privateKey;
		
		return this;
	};

	/**
	 * Sets the name for the account.
	 * 
	 * @param {string} name - The account name.
	 * @returns {AccountFixtureBuilder} The builder instance.
	 */
	setName = name => {
		this._data.name = name;
		
		return this;
	};

	/**
	 * Sets the balance for the account.
	 * 
	 * @param {number} balance - The account balance.
	 * @returns {AccountFixtureBuilder} The builder instance.
	 */
	setBalance = balance => {
		this._data.balance = balance;
		
		return this;
	};
}
