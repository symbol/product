import _ from 'lodash';
import { PersistentStorage } from 'src/storage';
import { AddressBook } from 'symbol-address-book';

export default {
    namespace: 'addressBook',
    state: {
        addressBook: new AddressBook([]), // address book object
        whiteList: [], // contains contacts from white list
        blackList: [], // contains contacts from black list
    },
    mutations: {
        // Set the address book object and sorted lists separately
        setAddressBook(state, payload) {
            const whiteList = _.orderBy(payload.getWhiteListedContacts(), ['name'], ['asc']);
            const blackList = _.orderBy(payload.getBlackListedContacts(), ['name'], ['asc']);

            state.addressBook.addressBook = payload;
            state.addressBook.whiteList = whiteList;
            state.addressBook.blackList = blackList;
            return state;
        },
    },
    actions: {
        // Load data from cache
        loadState: async ({ commit }) => {
            const addressBook = await PersistentStorage.getAddressBook();

            commit({ type: 'addressBook/setAddressBook', payload: addressBook });
        },
        // Add contact to address book. Cache updated object and update store
        addContact: async ({ commit, state }, contact) => {
            const { addressBook } = state.addressBook;
            addressBook.addContact(contact);

            await PersistentStorage.setAddressBook(addressBook);
            commit({ type: 'addressBook/setAddressBook', payload: addressBook });
        },
        // Update contact in address book. Cache updated object and update store
        updateContact: async ({ commit, state }, contact) => {
            const { addressBook } = state.addressBook;
            addressBook.updateContact(contact.id, contact);

            await PersistentStorage.setAddressBook(addressBook);
            commit({ type: 'addressBook/setAddressBook', payload: addressBook });
        },
        // Remove contact from address book. Cache updated object and update store
        removeContact: async ({ commit, state }, contact) => {
            const { addressBook } = state.addressBook;
            addressBook.removeContact(contact.id);

            await PersistentStorage.setAddressBook(addressBook);
            commit({ type: 'addressBook/setAddressBook', payload: addressBook });
        },
    },
};
