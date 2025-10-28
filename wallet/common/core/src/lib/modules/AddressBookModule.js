import { ErrorCode } from '../../constants';
import { ControllerError } from '../../error/ControllerError';
import { cloneNetworkArrayMap, createNetworkMap } from '../../utils/network';
import { PersistentStorageRepository } from '../storage/PersistentStorageRepository';

/** @typedef {import('../../types/AddressBook').Contact} Contact */

const createContact = contact => {
	return {
		id: contact.address,
		address: contact.address,
		name: contact.name,
		notes: contact.notes || '',
		isBlackListed: contact.isBlackListed || false
	};
};

const createDefaultState = networkIdentifiers => ({
	addressBook: createNetworkMap(() => [], networkIdentifiers)
});

export class AddressBookModule {
	static name = 'addressBook';

	_persistentStorageRepository;
	#walletController;
	#networkIdentifiers;
	#onStateChange;

	constructor() {}

	init = options => {
		this._state = createDefaultState(options.networkIdentifiers);
		this.#walletController = options.walletController;
		this._persistentStorageRepository = new PersistentStorageRepository(options.persistentStorageInterface);
		this.#onStateChange = options.onStateChange;
		this.#networkIdentifiers = options.networkIdentifiers;
	};

	/**
	 * Initializes the module. Loads the address book from the persistent storage.
	 * @returns {Promise<void>} A promise that resolves when the module is initialized.
	 */
	loadCache = async () => {
		const addressBook = await this.#loadAddressBook();

		this.resetState();

		this.#setState(() => {
			this._state.addressBook = addressBook;
		});
	};

	/**
	 * Clears the module state.
	 */
	resetState = () => {
		this._state = createDefaultState(this.#networkIdentifiers);
	};

	clear = () => {
		this.resetState();
	};

	#setState = callback => {
		callback.bind(this);
		callback();

		this.#onStateChange?.();
	};

	/**
	 * Gets the contacts from the address book for the current network.
	 * @returns {Contact[]} The contacts.
	 */
	get contacts() {
		return this._state.addressBook[this.#walletController.networkIdentifier];
	}

	/**
	 * Gets the blacklisted contacts from the address book for the current network.
	 * @returns {Contact[]} The blacklisted contacts.
	 */
	get blackList() {
		return this.contacts.filter(contact => contact.isBlackListed);
	}

	/**
	 * Gets the whitelisted contacts from the address book for the current network.
	 * @returns {Contact[]} The whitelisted contacts
	 */
	get whiteList() {
		return this.contacts.filter(contact => !contact.isBlackListed);
	}

	/**
	 * Gets a contact by its id.
	 * @param {string} id - The id of the contact.
	 * @returns {Contact} The contact.
	 */
	getContactById = id => {
		return this.contacts.find(contact => contact.id === id) || null;
	};

	/**
	 * Gets a contact by its address.
	 * @param {string} address - The address of the contact.
	 * @returns {Contact} The contact.
	 */
	getContactByAddress = address => {
		return this.contacts.find(contact => contact.address === address) || null;
	};

	/**
	 * Adds a contact to the address book.
	 * @param {Contact} newContact - The contact to add.
	 * @returns {Promise} A promise that resolves when the contact is
	 * added to the address book.
	 */
	addContact = async newContact => {
		const addressBook = await this.#loadAddressBook();
		const networkContacts = addressBook[this.#walletController.networkIdentifier];
		const isContactAlreadyExists = networkContacts.find(contact => contact.address === newContact.address);

		if (isContactAlreadyExists) {
			throw new ControllerError(
				`Failed to add contact. Contact with address "${newContact.address}" already exists`,
				ErrorCode.ADDRESS_BOOK_ADD_CONTACT_ALREADY_EXISTS
			);
		}

		networkContacts.push(createContact(newContact));
		await this._persistentStorageRepository.setAddressBook(addressBook);

		this.#setState(() => {
			this._state.addressBook = addressBook;
		});
	};

	/**
	 * Removes a contact from the address book.
	 * @param {string} id - The id of the contact to remove.
	 * @returns {Promise} A promise that resolves when the contact is
	 * removed from the address book.
	 */
	removeContact = async id => {
		const addressBook = await this.#loadAddressBook();
		const networkContacts = addressBook[this.#walletController.networkIdentifier];
		const updatedNetworkContacts = networkContacts.filter(contact => contact.id !== id);

		if (networkContacts.length === updatedNetworkContacts.length) {
			throw new ControllerError(
				`Failed to remove contact. Contact with id "${id}" not found`,
				ErrorCode.ADDRESS_BOOK_REMOVE_CONTACT_NOT_FOUND
			);
		}

		addressBook[this.#walletController.networkIdentifier] = updatedNetworkContacts;
		await this._persistentStorageRepository.setAddressBook(addressBook);

		this.#setState(() => {
			this._state.addressBook = addressBook;
		});
	};

	/**
	 * Updates a contact in the address book.
	 * @param {Contact} newContact - The updated contact.
	 * @returns {Promise} A promise that resolves when the contact is
	 * updated in the address book.
	 */
	updateContact = async newContact => {
		const addressBook = await this.#loadAddressBook();
		const networkContacts = addressBook[this.#walletController.networkIdentifier];
		const contactToUpdate = networkContacts.find(contact => contact.id === newContact.id);

		if (!contactToUpdate) {
			throw new ControllerError(
				`Failed to update contact. Contact with id "${newContact.id}" not found`,
				ErrorCode.ADDRESS_BOOK_UPDATE_CONTACT_NOT_FOUND
			);
		}

		Object.assign(contactToUpdate, createContact(newContact));
		await this._persistentStorageRepository.setAddressBook(addressBook);

		this.#setState(() => {
			this._state.addressBook = addressBook;
		});
	};

	#loadAddressBook = async () => {
		const addressBook = await this._persistentStorageRepository.getAddressBook();
		const defaultState = createDefaultState(this.#networkIdentifiers);

		return cloneNetworkArrayMap(
			addressBook,
			this.#networkIdentifiers,
			defaultState.addressBook
		);
	};
}
