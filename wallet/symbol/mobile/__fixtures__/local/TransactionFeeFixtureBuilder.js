
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';

const DEFAULT_CHAIN_NAME = 'symbol';
const DEFAULT_NETWORK_IDENTIFIER = 'testnet';

const createTokenWithAmount = (chainName, networkIdentifier, amount) => {
	return TokenFixtureBuilder
		.createWithToken(chainName, networkIdentifier, 0)
		.setAmount(amount)
		.build();
};

const createSymbolTransactionFeeTiers = (chainName, networkIdentifier, slow, medium, fast) => {
	const tokenSlow = createTokenWithAmount(chainName, networkIdentifier, slow);
	const tokenMedium = createTokenWithAmount(chainName, networkIdentifier, medium);
	const tokenFast = createTokenWithAmount(chainName, networkIdentifier, fast);

	return {
		slow: { token: tokenSlow },
		medium: { token: tokenMedium },
		fast: { token: tokenFast }
	};
};

const createEthereumTransactionFeeTiers = (chainName, networkIdentifier, slow, medium, fast) => {
	const tokenSlow = createTokenWithAmount(chainName, networkIdentifier, slow);
	const tokenMedium = createTokenWithAmount(chainName, networkIdentifier, medium);
	const tokenFast = createTokenWithAmount(chainName, networkIdentifier, fast);

	return {
		slow: {
			gasLimit: '1000',
			maxFeePerGas: '0.1',
			maxPriorityFeePerGas: '5',
			token: tokenSlow
		},
		medium: {
			gasLimit: '1000',
			maxFeePerGas: '0.2',
			maxPriorityFeePerGas: '6',
			token: tokenMedium
		},
		fast: {
			gasLimit: '1000',
			maxFeePerGas: '0.3',
			maxPriorityFeePerGas: '7',
			token: tokenFast
		}
	};
};

const EMPTY_FIXTURE_SYMBOL = createSymbolTransactionFeeTiers('symbol', 'testnet', '0', '0', '0');
const EMPTY_FIXTURE_ETHEREUM = createEthereumTransactionFeeTiers('ethereum', 'testnet', '0', '0', '0');

const createTransactionFeeTiers = (chainName, networkIdentifier, slow, medium, fast) => {
	return 'ethereum' === chainName
		? createEthereumTransactionFeeTiers(chainName, networkIdentifier, slow, medium, fast)
		: createSymbolTransactionFeeTiers(chainName, networkIdentifier, slow, medium, fast);
};

export class TransactionFeeFixtureBuilder {
	_data = {};
	_chainName = DEFAULT_CHAIN_NAME;
	_networkIdentifier = DEFAULT_NETWORK_IDENTIFIER;

	/**
     * Creates a transaction fee fixture with the provided data.
     * 
     * @param {import('wallet-common-core/src/types/Transaction').TransactionFeeTiers | object} data - Transaction fee data.
     * @param {'symbol' | 'ethereum'} [chainName] - Chain name.
     * @param {'mainnet' | 'testnet'} [networkIdentifier] - Network identifier.
     */
	constructor(data, chainName = DEFAULT_CHAIN_NAME, networkIdentifier = DEFAULT_NETWORK_IDENTIFIER) {
		this._data = { ...data };
		this._chainName = chainName;
		this._networkIdentifier = networkIdentifier;
	}

	/**
     * Creates an empty transaction fee fixture.
     * 
     * @param {'symbol' | 'ethereum'} [chainName='symbol'] - Chain name.
     * @returns {TransactionFeeFixtureBuilder}
     */
	static createEmpty = (chainName = DEFAULT_CHAIN_NAME) => {
		const data = 'ethereum' === chainName ? EMPTY_FIXTURE_ETHEREUM : EMPTY_FIXTURE_SYMBOL;

		return new TransactionFeeFixtureBuilder(data, chainName, DEFAULT_NETWORK_IDENTIFIER);
	};

	/**
     * Creates a transaction fee fixture with the provided chain and network.
     * 
     * @param {'symbol' | 'ethereum'} chainName - Chain name.
     * @param {'mainnet' | 'testnet'} networkIdentifier - Network identifier.
     * @returns {TransactionFeeFixtureBuilder}
     */
	static createWithNetwork = (chainName, networkIdentifier) => {
		return new TransactionFeeFixtureBuilder(
			createTransactionFeeTiers(chainName, networkIdentifier, '0', '0', '0'),
			chainName,
			networkIdentifier
		);
	};

	/**
     * Creates a transaction fee fixture with the provided amounts for each fee tier.
     * 
     * @param {string} slow - The fee amount for the slow tier.
     * @param {string} medium - The fee amount for the medium tier.
     * @param {string} fast - The fee amount for the fast tier.
     * @param {'symbol' | 'ethereum'} [chainName='symbol'] - Chain name.
     * @param {'mainnet' | 'testnet'} [networkIdentifier='testnet'] - Network identifier.
     * @returns {TransactionFeeFixtureBuilder}
     */
	static createWithAmounts = (
		slow,
		medium,
		fast,
		chainName = DEFAULT_CHAIN_NAME,
		networkIdentifier = DEFAULT_NETWORK_IDENTIFIER
	) => {
		return new TransactionFeeFixtureBuilder(
			createTransactionFeeTiers(chainName, networkIdentifier, slow, medium, fast),
			chainName,
			networkIdentifier
		);
	};

	/**
     * Creates a transaction fee fixture with the provided data.
     * 
     * @param {import('wallet-common-core/src/types/Transaction').TransactionFeeTiers | object} data - Transaction fee data.
     * @param {'symbol' | 'ethereum'} [chainName='symbol'] - Chain name.
     * @param {'mainnet' | 'testnet'} [networkIdentifier='testnet'] - Network identifier.
     * @returns {TransactionFeeFixtureBuilder}
     */
	static createWithData = (
		data,
		chainName = DEFAULT_CHAIN_NAME,
		networkIdentifier = DEFAULT_NETWORK_IDENTIFIER
	) => {
		return new TransactionFeeFixtureBuilder(data, chainName, networkIdentifier);
	};

	/**
     * Gets the built transaction fee data.
     * 
     * @returns {import('wallet-common-core/src/types/Transaction').TransactionFeeTiers | object}
     */
	build() {
		return { ...this._data };
	};

	/**
     * Overrides the transaction fee data with the provided data.
     * 
     * @param {Partial<import('wallet-common-core/src/types/Transaction').TransactionFeeTiers> | object} data - The data to override.
     * @returns {TransactionFeeFixtureBuilder} The builder instance.
     */
	override = data => {
		this._data = { ...this._data, ...data };
        
		return this;
	};

	/**
     * Sets slow tier token amount.
     * 
     * @param {string} amount - Slow tier amount.
     * @returns {TransactionFeeFixtureBuilder} The builder instance.
     */
	setSlowAmount = amount => {
		this._data.slow = {
			...this._data.slow,
			token: createTokenWithAmount(this._chainName, this._networkIdentifier, amount)
		};

		return this;
	};

	/**
     * Sets medium tier token amount.
     * 
     * @param {string} amount - Medium tier amount.
     * @returns {TransactionFeeFixtureBuilder} The builder instance.
     */
	setMediumAmount = amount => {
		this._data.medium = {
			...this._data.medium,
			token: createTokenWithAmount(this._chainName, this._networkIdentifier, amount)
		};

		return this;
	};

	/**
     * Sets fast tier token amount.
     * 
     * @param {string} amount - Fast tier amount.
     * @returns {TransactionFeeFixtureBuilder} The builder instance.
     */
	setFastAmount = amount => {
		this._data.fast = {
			...this._data.fast,
			token: createTokenWithAmount(this._chainName, this._networkIdentifier, amount)
		};

		return this;
	};

	/**
     * Overrides slow tier.
     * 
     * @param {object} slow - Slow tier override data.
     * @returns {TransactionFeeFixtureBuilder} The builder instance.
     */
	overrideSlow = slow => {
		this._data.slow = { ...this._data.slow, ...slow };

		return this;
	};

	/**
     * Overrides medium tier.
     * 
     * @param {object} medium - Medium tier override data.
     * @returns {TransactionFeeFixtureBuilder} The builder instance.
     */
	overrideMedium = medium => {
		this._data.medium = { ...this._data.medium, ...medium };

		return this;
	};

	/**
     * Overrides fast tier.
     * 
     * @param {object} fast - Fast tier override data.
     * @returns {TransactionFeeFixtureBuilder} The builder instance.
     */
	overrideFast = fast => {
		this._data.fast = { ...this._data.fast, ...fast };

		return this;
	};
}
