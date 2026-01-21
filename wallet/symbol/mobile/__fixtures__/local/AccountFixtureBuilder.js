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
	get data() {
		return { ...this._data };
	};

	override = data => {
		this._data = { ...this._data, ...data };
		
		return this;
	};

	setSeedIndex = index => {
		this._data.index = index;
        
		return this;
	};

	setAccountType = accountType => {
		this._data.accountType = accountType;
        
		return this;
	};

	setAddress = address => {
		this._data.address = address;
        
		return this;
	};

	setPublicKey = publicKey => {
		this._data.publicKey = publicKey;
        
		return this;
	};

	setPrivateKey = privateKey => {
		this._data.privateKey = privateKey;
        
		return this;
	};

	setName = name => {
		this._data.name = name;
        
		return this;
	};

	setBalance = balance => {
		this._data.balance = balance;
        
		return this;
	};
}
