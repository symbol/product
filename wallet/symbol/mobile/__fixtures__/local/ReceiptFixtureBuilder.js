const EMPTY_FIXTURE = {
	type: '',
	amount: '0',
	timestamp: 0,
	height: 0
};

const DEFAULT_HARVESTING_REWARD_FIXTURE = {
	type: 'harvestingReward',
	amount: '54.17',
	timestamp: 1584265310994,
	height: 222222
};

export class ReceiptFixtureBuilder {
	_data = {};

	/**
	 * Creates a receipt fixture with the provided data.
	 * 
	 * @param {object} data - Receipt data.
	 */
	constructor(data) {
		this._data = { ...data };
	}

	/**
	 * Creates an empty receipt fixture.
	 * 
	 * @returns {ReceiptFixtureBuilder}
	 */
	static createEmpty = () => {
		return new ReceiptFixtureBuilder(EMPTY_FIXTURE);
	};

	/**
	 * Creates a receipt fixture with the provided data.
	 * 
	 * @param {object} data - Receipt data.
	 * @returns {ReceiptFixtureBuilder}
	 */
	static createWithData = data => {
		return new ReceiptFixtureBuilder(data);
	};

	/**
	 * Creates a harvesting reward receipt fixture.
	 * 
	 * @param {string} [amount] - Reward amount.
	 * @param {number} [height] - Block height.
	 * @param {number} [timestamp] - Receipt timestamp.
	 * @returns {ReceiptFixtureBuilder}
	 */
	static createHarvestingReward = (amount, height, timestamp) => {
		return new ReceiptFixtureBuilder({
			...DEFAULT_HARVESTING_REWARD_FIXTURE,
			amount: amount ?? DEFAULT_HARVESTING_REWARD_FIXTURE.amount,
			height: height ?? DEFAULT_HARVESTING_REWARD_FIXTURE.height,
			timestamp: timestamp ?? DEFAULT_HARVESTING_REWARD_FIXTURE.timestamp
		});
	};

	/**
	 * Gets the built receipt data.
	 * 
	 * @returns {object}
	 */
	build() {
		return { ...this._data };
	};

	/**
	 * Overrides the receipt data with the provided data.
	 * 
	 * @param {object} data - The data to override.
	 * @returns {ReceiptFixtureBuilder} The builder instance.
	 */
	override = data => {
		this._data = { ...this._data, ...data };
		
		return this;
	};

	/**
	 * Sets the receipt type.
	 * 
	 * @param {string} type - The receipt type.
	 * @returns {ReceiptFixtureBuilder} The builder instance.
	 */
	setType = type => {
		this._data.type = type;
        
		return this;
	};

	/**
	 * Sets the receipt amount.
	 * 
	 * @param {string} amount - The receipt amount.
	 * @returns {ReceiptFixtureBuilder} The builder instance.
	 */
	setAmount = amount => {
		this._data.amount = amount;
        
		return this;
	};

	/**
	 * Sets the receipt timestamp.
	 * 
	 * @param {number} timestamp - The receipt timestamp.
	 * @returns {ReceiptFixtureBuilder} The builder instance.
	 */
	setTimestamp = timestamp => {
		this._data.timestamp = timestamp;
        
		return this;
	};

	/**
	 * Sets the receipt height.
	 * 
	 * @param {number} height - The receipt height.
	 * @returns {ReceiptFixtureBuilder} The builder instance.
	 */
	setHeight = height => {
		this._data.height = height;
        
		return this;
	};
}
