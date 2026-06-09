import { networkProperties } from '__fixtures__/local/network';

const EMPTY_FIXTURE = {
	networkIdentifier: '',
	networkCurrency: {
		name: '',
		id: '',
		divisibility: 0
	}
};

export class NetworkPropertiesFixtureBuilder {
	_data = {};

	/**
	 * Creates a network properties fixture with the provided data.
	 * 
	 * @param {import('wallet-common-core/src/types/Network').NetworkProperties} data - Network properties data.
	 */
	constructor(data) {
		this._data = { ...data };
	}

	/**
	 * Creates an empty network properties fixture.
	 * 
	 * @returns {NetworkPropertiesFixtureBuilder}
	 */
	static createEmpty = () => {
		return new NetworkPropertiesFixtureBuilder(EMPTY_FIXTURE);
	};

	/**
	 * Creates an network properties fixture with default data for the specified chain and network.
	 * Used data from the fixture list.
	 * 
	 * @param {string} chainName - Chain name.
	 * @param {'mainnet' | 'testnet'} networkIdentifier - Network identifier.
	 * @returns {NetworkPropertiesFixtureBuilder}
	 */
	static createWithType = (chainName, networkIdentifier) => {
		const network = networkProperties[chainName][networkIdentifier];

		if (!network) 
			throw new Error(`network properties fixture not found for chain=${chainName}, network=${networkIdentifier}`);
		
		return new NetworkPropertiesFixtureBuilder(network);
	};

	/**
	 * Creates an network properties fixture with the provided data.
	 * 
	 * @param {import('wallet-common-core/src/types/Network').NetworkProperties} data - Network properties data.
	 * @returns {NetworkPropertiesFixtureBuilder}
	 */
	static createWithData = data => {
		return new NetworkPropertiesFixtureBuilder(data);
	};

	/**
	 * Gets the built network properties data.
	 * 
	 * @returns {import('wallet-common-core/src/types/Network').NetworkProperties}
	 */
	build() {
		return { ...this._data };
	};

	/**
	 * Overrides the network properties data with the provided data.
	 * 
	 * @param {object} data - The data to override.
	 * @returns {NetworkPropertiesFixtureBuilder} The builder instance.
	 */
	override = data => {
		this._data = { ...this._data, ...data };
		
		return this;
	};

	/**
	 * Sets the node URL for the network.
	 * 
	 * @param {string} nodeUrl - The node URL.
	 * @returns {NetworkPropertiesFixtureBuilder} The builder instance.
	 */
	setNodeUrl = nodeUrl => {
		this._data.nodeUrl = nodeUrl;
		
		return this;
	};

	/**
	 * Sets the network identifier.
	 * 
	 * @param {string} networkIdentifier - The network identifier.
	 * @returns {NetworkPropertiesFixtureBuilder} The builder instance.
	 */
	setNetworkIdentifier = networkIdentifier => {
		this._data.networkIdentifier = networkIdentifier;
		
		return this;
	};

	/**
	 * Sets the chain height.
	 * 
	 * @param {number} chainHeight - The chain height.
	 * @returns {NetworkPropertiesFixtureBuilder} The builder instance.
	 */
	setChainHeight = chainHeight => {
		this._data.chainHeight = chainHeight;
		
		return this;
	};

	/**
	 * Sets the epoch adjustment.
	 * 
	 * @param {number} epochAdjustment - The epoch adjustment.
	 * @returns {NetworkPropertiesFixtureBuilder} The builder instance.
	 */
	setEpochAdjustment = epochAdjustment => {
		this._data.epochAdjustment = epochAdjustment;
		
		return this;
	};

	/**
	 * Sets the transaction fees.
	 * 
	 * @param {object} transactionFees - The transaction fees.
	 * @returns {NetworkPropertiesFixtureBuilder} The builder instance.
	 */
	setTransactionFees = transactionFees => {
		this._data.transactionFees = transactionFees;
		
		return this;
	};

	/**
	 * Sets the network currency.
	 * 
	 * @param {import('wallet-common-core/src/types/Token').TokenInfo} networkCurrency - The network currency.
	 * @returns {NetworkPropertiesFixtureBuilder} The builder instance.
	 */
	setNetworkCurrency = networkCurrency => {
		this._data.networkCurrency = networkCurrency;
		
		return this;
	};
}
