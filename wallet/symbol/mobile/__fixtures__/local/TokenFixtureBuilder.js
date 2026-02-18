import { tokens } from '__fixtures__/local/token';

const EMPTY_FIXTURE = {
	name: '',
	id: '',
	divisibility: 0
};

export class TokenFixtureBuilder {
	_data = {};

	/**
	 * Creates a token fixture with the provided data.
	 * 
	 * @param {import('wallet-common-core/src/types/Token').Token} data - token data.
	 */
	constructor(data) {
		this._data = { ...data };
	}

	/**
	 * Creates an empty Token fixture.
	 * 
	 * @returns {TokenFixtureBuilder}
	 */
	static createEmpty = () => {
		return new TokenFixtureBuilder(EMPTY_FIXTURE);
	};

	/**
	 * Creates an Token fixture with default data for the specified chain and network.
	 * Used data from the fixture list.
	 * 
	 * @param {string} chainName - chain name the Token belongs to.
	 * @param {'mainnet' | 'testnet'} networkIdentifier - network identifier the Token belongs to.
	 * @param {number} index - Token item index in the fixture list (eg. 0, 1, 2, ...).
	 * @returns {TokenFixtureBuilder}
	 */
	static createWithToken = (chainName, networkIdentifier, index) => {
		const Token = tokens[chainName][networkIdentifier][index];

		if (!Token) 
			throw new Error(`Token fixture not found for chain=${chainName}, network=${networkIdentifier}, index=${index}`);
		
		return new TokenFixtureBuilder(Token);
	};

	/**
	 * Creates an Token fixture with the provided data.
	 * 
	 * @param {import('wallet-common-core/src/types/Token').Token} data - Token data.
	 * @returns {TokenFixtureBuilder}
	 */
	static createWithData = data => {
		return new TokenFixtureBuilder(data);
	};

	/**
	 * Gets the built Token data.
	 * 
	 * @returns {import('wallet-common-core/src/types/Token').Token}
	 */
	build() {
		return { ...this._data };
	};

	/**
	 * Overrides the token data with the provided data.
	 * 
	 * @param {object} data - The data to override.
	 * @returns {TokenFixtureBuilder} The builder instance.
	 */
	override = data => {
		this._data = { ...this._data, ...data };
		
		return this;
	};

	/**
	 * Sets the ID for the token.
	 * 
	 * @param {string} id - The token ID.
	 * @returns {TokenFixtureBuilder} The builder instance.
	 */
	setId = id => {
		this._data.id = id;
		
		return this;
	};

	/**
	 * Sets the name for the token.
	 * 
	 * @param {string} name - The token name.
	 * @returns {TokenFixtureBuilder} The builder instance.
	 */
	setName = name => {
		this._data.name = name;
		
		return this;
	};

	/**
	 * Sets the divisibility for the token.
	 * 
	 * @param {number} divisibility - The token divisibility.
	 * @returns {TokenFixtureBuilder} The builder instance.
	 */
	setDivisibility = divisibility => {
		this._data.divisibility = divisibility;
		
		return this;
	};

	/**
	 * Sets the amount for the token.
	 * 
	 * @param {string} amount - The token amount.
	 * @returns {TokenFixtureBuilder} The builder instance.
	 */
	setAmount = amount => {
		this._data.amount = amount;
		
		return this;
	};
}
