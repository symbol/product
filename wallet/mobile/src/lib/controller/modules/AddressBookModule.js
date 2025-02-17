import { cloneDeep } from 'lodash';
import { makeAutoObservable, runInAction } from 'mobx';
import { createNetworkMap } from 'src/utils/helper';
import { v4 as uuidv4 } from 'uuid';

const createContact = (contact) => {
    return {
        id: contact.id || uuidv4(),
        address: contact.address || '',
        name: contact.name || '',
        notes: contact.notes || '',
        isBlackListed: contact.isBlackListed || false,
    };
}

const defaultState = {
    addressBook: createNetworkMap(() => []),
};

export class AddressBookModule {
    constructor({ root, isObservable }) {
        this.name = 'addressBook';
        this._state = cloneDeep(defaultState);

        if (isObservable)
            makeAutoObservable(this);

        this._root = root;
    }

    loadCache = async () => {
        const addressBook = await this._root._persistentStorage.getAddressBook();

        this.clearState();

        runInAction(() => {
            this._state.addressBook = addressBook;
        });
    }

    clearState = () => {
        this._state = cloneDeep(defaultState);
    }

    get contacts() {
        return this._state.addressBook[this._root.networkIdentifier];
    }

    get blackList() {
        return this.contacts.filter(contact => contact.isBlackListed);;
    }

    get whiteList() {
        return this.contacts.filter(contact => !contact.isBlackListed);
    }

    getContactById = (id) => {
        return this.contacts.find(contact => contact.id === id) || null;
    }

    getContactByAddress = (address) => {
        return this.contacts.find(contact => contact.address === address) || null;
    }

    addContact = async (newContact) =>{
        const addressBook = await this._root._persistentStorage.getAddressBook();
        const networkContacts = addressBook[this._root.networkIdentifier];
        const isContactAlreadyExists = networkContacts.find((contact) => contact.address === newContact.address);

        if (isContactAlreadyExists) {
            this._throwError('error_failed_add_contact_already_exists');
        }

        networkContacts.push(createContact(newContact));
        await this._root._persistentStorage.setAddressBook(addressBook);

        runInAction(() => {
            this._state.addressBook = addressBook;
        });
    }

    removeContact = async (id) => {
        const addressBook = await this._root._persistentStorage.getAddressBook();
        const networkContacts = addressBook[this._root.networkIdentifier];
        const updatedNetworkContacts = networkContacts.filter((contact) => contact.id !== id);

        if (networkContacts.length === updatedNetworkContacts.length) {
            this._throwError('error_failed_remove_contact_not_found');
        }

        addressBook[this._root.networkIdentifier] = updatedNetworkContacts;
        await this._root._persistentStorage.setAddressBook(addressBook);

        runInAction(() => {
            this._state.addressBook = addressBook;
        });
    }

    updateContact = async (newContact) => {
        const addressBook = await this._root._persistentStorage.getAddressBook();
        const networkContacts = addressBook[this._root.networkIdentifier];
        const contactToUpdate = networkContacts.find((contact) => contact.id === newContact.id);

        if (!contactToUpdate) {
            this._throwError('error_failed_update_contact_not_found');
        }

        Object.assign(contactToUpdate, createContact(newContact));
        await this._root._persistentStorage.setAddressBook(addressBook);

        runInAction(() => {
            this._state.addressBook = addressBook;
        });
    }

    _setAddressBook = async (addressBook) => {
        await this._root._persistentStorage.setAddressBook(addressBook);

        runInAction(() => {
            this._state.addressBook = addressBook;
        });
    }
}
