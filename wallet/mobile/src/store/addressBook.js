import _ from 'lodash';
import { PersistentStorage } from 'src/storage';
import { AddressBook } from 'symbol-address-book';

export default {
    namespace: 'addressBook',
    state: {
        addressBook: new AddressBook([]),
        whiteList: [],
        blackList: []
    },
    mutations: {
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
        loadState: async ({ commit }) => {
            const addressBook = await PersistentStorage.getAddressBook();
            
            commit({type: 'addressBook/setAddressBook', payload: addressBook});
        },
        addContact: async ({ commit, state }, contact) => {
            const { addressBook } = state.addressBook;
            addressBook.addContact(contact);
            
            await PersistentStorage.setAddressBook(addressBook)
            commit({type: 'addressBook/setAddressBook', payload: addressBook});
        },
        updateContact: async ({ commit, state }, contact) => {
            const { addressBook } = state.addressBook;
            addressBook.updateContact(contact.id, contact);
            
            await PersistentStorage.setAddressBook(addressBook)
            commit({type: 'addressBook/setAddressBook', payload: addressBook});
        },
        removeContact: async ({ commit, state }, contact) => {
            const { addressBook } = state.addressBook;
            addressBook.removeContact(contact.id);
            
            await PersistentStorage.setAddressBook(addressBook)
            commit({type: 'addressBook/setAddressBook', payload: addressBook});
        },
    },
};
