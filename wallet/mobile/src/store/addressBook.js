import { PersistentStorage } from 'src/storage';
import { AddressBook } from 'symbol-address-book';

export default {
    namespace: 'addressBook',
    state: {
        addressBook: new AddressBook([])
    },
    mutations: {
        setAddressBook(state, payload) {
            state.addressBook.addressBook = payload;
            return state;
        },
    },
    actions: {
        loadState: async ({ commit }) => {
            const addressBook = await PersistentStorage.getAddressBook();
            
            commit({type: 'addressBook/setAddressBook', payload: addressBook});
        },
        addContact: async ({ commit }, contact) => {
            const addressBook = await PersistentStorage.getAddressBook();
            addressBook.addContact(contact);
            
            await PersistentStorage.setAddressBook(addressBook)
            commit({type: 'addressBook/setAddressBook', payload: addressBook});
        },
        updateContact: async ({ commit }, contact) => {
            const addressBook = await PersistentStorage.getAddressBook();
            addressBook.updateContact(contact.id, contact);
            
            await PersistentStorage.setAddressBook(addressBook)
            commit({type: 'addressBook/setAddressBook', payload: addressBook});
        },
        removeContact: async ({ commit }, contact) => {
            const addressBook = await PersistentStorage.getAddressBook();
            addressBook.removeContact(contact.id);
            
            await PersistentStorage.setAddressBook(addressBook)
            commit({type: 'addressBook/setAddressBook', payload: addressBook});
        },
    },
};
