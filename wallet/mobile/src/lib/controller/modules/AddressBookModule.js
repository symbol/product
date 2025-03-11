import { cloneDeep } from 'lodash';
import { makeAutoObservable, runInAction } from 'mobx';
import { createNetworkMap } from '@/app/utils/network';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/app/lib/error';
import * as AddressBookTypes from '@/app/types/AddressBook';

const createContact = (contact) => {
    return {
        id: contact.id || uuidv4(),
        address: contact.address || '',
        name: contact.name || '',
        notes: contact.notes || '',
        isBlackListed: contact.isBlackListed || false,
    };
};

const defaultState = {
    addressBook: createNetworkMap(() => []),
};

/**
 * A module that manages the address book.
 */
export class AddressBookModule {
    constructor({ root, isObservable }) {
        this.name = 'addressBook';
        this._state = cloneDeep(defaultState);

        if (isObservable) makeAutoObservable(this);

        this._root = root;
    }

    /**
     * Initializes the module. Loads the address book from the persistent storage.
     * @returns {Promise<void>} A promise that resolves when the module is initialized.
     */
    loadCache = async () => {
        const addressBook = await this._root._persistentStorage.getAddressBook();

        this.clearState();

        runInAction(() => {
            this._state.addressBook = addressBook;
        });
    };

    /**
     * Clears the module state.
     */
    clearState = () => {
        this._state = cloneDeep(defaultState);
    };

    /**
     * Gets the contacts from the address book for the current network.
     * @returns {AddressBookTypes.Contact[]} The contacts.
     */
    get contacts() {
        return this._state.addressBook[this._root.networkIdentifier];
    }

    /**
     * Gets the blacklisted contacts from the address book for the current network.
     * @returns {AddressBookTypes.Contact[]} The blacklisted contacts.
     */
    get blackList() {
        return this.contacts.filter((contact) => contact.isBlackListed);
    }

    /**
     * Gets the whitelisted contacts from the address book for the current network.
     * @returns {AddressBookTypes.Contact[]} The whitelisted contacts
     */
    get whiteList() {
        return this.contacts.filter((contact) => !contact.isBlackListed);
    }

    /**
     * Gets a contact by its id.
     * @param {string} id - The id of the contact.
     * @returns {AddressBookTypes.Contact} The contact.
     */
    getContactById = (id) => {
        return this.contacts.find((contact) => contact.id === id) || null;
    };

    /**
     * Gets a contact by its address.
     * @param {string} address - The address of the contact.
     * @returns {AddressBookTypes.Contact} The contact.
     */
    getContactByAddress = (address) => {
        return this.contacts.find((contact) => contact.address === address) || null;
    };

    /**
     * Adds a contact to the address book.
     * @param {AddressBookTypes.Contact} newContact - The contact to add.
     * @returns {Promise} A promise that resolves when the contact is
     * added to the address book.
     */
    addContact = async (newContact) => {
        const addressBook = await this._root._persistentStorage.getAddressBook();
        const networkContacts = addressBook[this._root.networkIdentifier];
        const isContactAlreadyExists = networkContacts.find((contact) => contact.address === newContact.address);

        if (isContactAlreadyExists) {
            throw new AppError(
                'error_failed_add_contact_already_exists',
                `Failed to add contact. Contact with address "${newContact.address}" already exists`
            );
        }

        networkContacts.push(createContact(newContact));
        await this._root._persistentStorage.setAddressBook(addressBook);

        runInAction(() => {
            this._state.addressBook = addressBook;
        });
    };

    /**
     * Removes a contact from the address book.
     * @param {string} id - The id of the contact to remove.
     * @returns {Promise} A promise that resolves when the contact is
     * removed from the address book.
     */
    removeContact = async (id) => {
        const addressBook = await this._root._persistentStorage.getAddressBook();
        const networkContacts = addressBook[this._root.networkIdentifier];
        const updatedNetworkContacts = networkContacts.filter((contact) => contact.id !== id);

        if (networkContacts.length === updatedNetworkContacts.length) {
            throw new AppError('error_failed_remove_contact_not_found', `Failed to remove contact. Contact with id "${id}" not found`);
        }

        addressBook[this._root.networkIdentifier] = updatedNetworkContacts;
        await this._root._persistentStorage.setAddressBook(addressBook);

        runInAction(() => {
            this._state.addressBook = addressBook;
        });
    };

    /**
     * Updates a contact in the address book.
     * @param {AddressBookTypes.Contact} newContact - The updated contact.
     * @returns {Promise} A promise that resolves when the contact is
     * updated in the address book.
     */
    updateContact = async (newContact) => {
        const addressBook = await this._root._persistentStorage.getAddressBook();
        const networkContacts = addressBook[this._root.networkIdentifier];
        const contactToUpdate = networkContacts.find((contact) => contact.id === newContact.id);

        if (!contactToUpdate) {
            throw new AppError(
                'error_failed_update_contact_not_found',
                `Failed to update contact. Contact with id "${newContact.id}" not found`
            );
        }

        Object.assign(contactToUpdate, createContact(newContact));
        await this._root._persistentStorage.setAddressBook(addressBook);

        runInAction(() => {
            this._state.addressBook = addressBook;
        });
    };

    /**
     * Sets the address book.
     * @param {AddressBookTypes.AddressBook} addressBook - The address book.
     * @returns {Promise} A promise that resolves when the address book is set.
     * @private
     */
    _setAddressBook = async (addressBook) => {
        await this._root._persistentStorage.setAddressBook(addressBook);

        runInAction(() => {
            this._state.addressBook = addressBook;
        });
    };
}
