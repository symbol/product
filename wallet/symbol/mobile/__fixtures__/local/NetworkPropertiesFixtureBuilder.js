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
     * @param {string} chainName - chain name.
     * @param {'mainnet' | 'testnet'} networkIdentifier - network identifier.
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
     * @param {import('wallet-common-core/src/types/Network').NetworkProperties} data - network properties data.
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
	get data() {
		return { ...this._data };
	};

	override = data => {
		this._data = { ...this._data, ...data };
		
		return this;
	};

	setNodeUrl = nodeUrl => {
		this._data.nodeUrl = nodeUrl;
        
		return this;
	};

	setNetworkIdentifier = networkIdentifier => {
		this._data.networkIdentifier = networkIdentifier;
        
		return this;
	};

	setChainHeight = chainHeight => {
		this._data.chainHeight = chainHeight;
        
		return this;
	};

	setEpochAdjustment = epochAdjustment => {
		this._data.epochAdjustment = epochAdjustment;
        
		return this;
	};

	setTransactionFees = transactionFees => {
		this._data.transactionFees = transactionFees;
        
		return this;
	};

	setNetworkCurrency = networkCurrency => {
		this._data.networkCurrency = networkCurrency;
        
		return this;
	};
}
