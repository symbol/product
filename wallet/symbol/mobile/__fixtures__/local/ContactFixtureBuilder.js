import { walletStorageAccounts } from '__fixtures__/local/wallet';

const EMPTY_FIXTURE = {
	id: '',
	address: '',
	name: '',
	notes: '',
	isBlackListed: false
};

const DEFAULT_WHITELIST_FIXTURE = {
	id: 'TWHITEL-ISTED-CONTA-CTADD-RESSF-IXTUR-EAA',
	address: 'TWHITEL-ISTED-CONTA-CTADD-RESSF-IXTUR-EAA',
	name: 'Whitelist Contact',
	notes: 'Default whitelist contact',
	isBlackListed: false
};

const DEFAULT_BLACKLIST_FIXTURE = {
	id: 'TBLACKL-ISTED-CONTA-CTADD-RESSF-IXTUR-EBB',
	address: 'TBLACKL-ISTED-CONTA-CTADD-RESSF-IXTUR-EBB',
	name: 'Blacklist Contact',
	notes: 'Default blacklist contact',
	isBlackListed: true
};

/**
 * @typedef {Object} Contact
 * @property {string} id - Contact ID (typically same as address).
 * @property {string} address - Contact address.
 * @property {string} name - Contact name.
 * @property {string} notes - Contact notes.
 * @property {boolean} isBlackListed - Whether the contact is blacklisted.
 */

export class ContactFixtureBuilder {
	_data = {};

	/**
	 * Creates a contact fixture with the provided data.
	 * 
	 * @param {Contact} data - Contact data.
	 */
	constructor(data) {
		this._data = { ...data };
	}

	/**
	 * Creates an empty contact fixture.
	 * 
	 * @returns {ContactFixtureBuilder}
	 */
	static createEmpty = () => {
		return new ContactFixtureBuilder(EMPTY_FIXTURE);
	};

	/**
	 * Creates a contact fixture with default data for the specified chain and network.
	 * Uses account data from the fixture list, mapping address to contact id and address.
	 * 
	 * @param {string} chainName - chain name the account belongs to.
	 * @param {'mainnet' | 'testnet'} networkIdentifier - network identifier the account belongs to.
	 * @param {number} index - account item index in the fixture list (eg. 0, 1, 2, ...).
	 * @returns {ContactFixtureBuilder}
	 */
	static createWithAccount = (chainName, networkIdentifier, index) => {
		const account = walletStorageAccounts[chainName][networkIdentifier][index];

		if (!account)
			throw new Error(`Contact fixture not found for chain=${chainName}, network=${networkIdentifier}, index=${index}`);

		return new ContactFixtureBuilder({
			...EMPTY_FIXTURE,
			id: account.address,
			address: account.address,
			name: `Contact_${index}`
		});
	};

	/**
	 * Creates a contact fixture with the provided data.
	 * 
	 * @param {Contact} data - Contact data.
	 * @returns {ContactFixtureBuilder}
	 */
	static createWithData = data => {
		return new ContactFixtureBuilder(data);
	};

	/**
	 * Creates a default whitelisted contact fixture.
	 * 
	 * @param {string} [name] - Contact name.
	 * @param {string} [address] - Contact address.
	 * @param {string} [notes] - Contact notes.
	 * @returns {ContactFixtureBuilder}
	 */
	static createWhitelisted = (name, address, notes) => {
		const id = address ?? DEFAULT_WHITELIST_FIXTURE.address;

		return new ContactFixtureBuilder({
			...DEFAULT_WHITELIST_FIXTURE,
			id,
			address: id,
			name: name ?? DEFAULT_WHITELIST_FIXTURE.name,
			notes: notes ?? DEFAULT_WHITELIST_FIXTURE.notes
		});
	};

	/**
	 * Creates a default blacklisted contact fixture.
	 * 
	 * @param {string} [name] - Contact name.
	 * @param {string} [address] - Contact address.
	 * @param {string} [notes] - Contact notes.
	 * @returns {ContactFixtureBuilder}
	 */
	static createBlacklisted = (name, address, notes) => {
		const id = address ?? DEFAULT_BLACKLIST_FIXTURE.address;

		return new ContactFixtureBuilder({
			...DEFAULT_BLACKLIST_FIXTURE,
			id,
			address: id,
			name: name ?? DEFAULT_BLACKLIST_FIXTURE.name,
			notes: notes ?? DEFAULT_BLACKLIST_FIXTURE.notes
		});
	};

	/**
	 * Gets the built contact data.
	 * 
	 * @returns {Contact}
	 */
	build() {
		return { ...this._data };
	};

	/**
	 * Overrides the contact data with the provided data.
	 * 
	 * @param {object} data - The data to override.
	 * @returns {ContactFixtureBuilder} The builder instance.
	 */
	override = data => {
		this._data = { ...this._data, ...data };
		
		return this;
	};

	/**
	 * Sets the ID for the contact.
	 * 
	 * @param {string} id - The contact ID.
	 * @returns {ContactFixtureBuilder} The builder instance.
	 */
	setId = id => {
		this._data.id = id;
		
		return this;
	};

	/**
	 * Sets the address for the contact.
	 * 
	 * @param {string} address - The contact address.
	 * @returns {ContactFixtureBuilder} The builder instance.
	 */
	setAddress = address => {
		this._data.address = address;
		
		return this;
	};

	/**
	 * Sets both ID and address for the contact (since they are typically the same).
	 * 
	 * @param {string} address - The contact address and ID.
	 * @returns {ContactFixtureBuilder} The builder instance.
	 */
	setIdAndAddress = address => {
		this._data.id = address;
		this._data.address = address;
		
		return this;
	};

	/**
	 * Sets the name for the contact.
	 * 
	 * @param {string} name - The contact name.
	 * @returns {ContactFixtureBuilder} The builder instance.
	 */
	setName = name => {
		this._data.name = name;
		
		return this;
	};

	/**
	 * Sets the notes for the contact.
	 * 
	 * @param {string} notes - The contact notes.
	 * @returns {ContactFixtureBuilder} The builder instance.
	 */
	setNotes = notes => {
		this._data.notes = notes;
		
		return this;
	};

	/**
	 * Sets whether the contact is blacklisted.
	 * 
	 * @param {boolean} isBlackListed - Whether the contact is blacklisted.
	 * @returns {ContactFixtureBuilder} The builder instance.
	 */
	setIsBlackListed = isBlackListed => {
		this._data.isBlackListed = isBlackListed;
		
		return this;
	};
}
