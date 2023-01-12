import _ from 'lodash';
import { PersistentStorage } from 'src/storage';

export default {
    namespace: 'addressBook',
    state: {
        whiteList: [],
        blackList: []
    },
    mutations: {
        setAddressBook(state, payload) {
            const whiteList = _.orderBy(payload.getWhiteListedContacts(), ['name'], ['asc']);
            const blackList = _.orderBy(payload.getBlackListedContacts(), ['name'], ['asc']);

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
            const contacts = addressBook.removeContact(contact.id);
            console.log(contact, contacts)
            
            await PersistentStorage.setAddressBook(addressBook)
            commit({type: 'addressBook/setAddressBook', payload: addressBook});
        },
    },
};
