import React, { useState } from 'react';
import { Screen, FormItem, StyledText, TextBox, Button, Dropdown } from 'src/components';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import store, { connect } from 'src/store';
import { handleError, useDataManager, useProp, useValidation, validateAccountName, validateRequired, validateAddress, validateExisted } from 'src/utils';

export const AddressBookAddContact = connect(state => ({
    accounts: state.wallet.accounts,
    addressBook: state.addressBook.addressBook,
    networkIdentifier: state.network.networkIdentifier
}))(function AddressBookAddContact(props) {
    const { accounts, addressBook, networkIdentifier } = props;
    const existedNames = [
        ...addressBook.getAllContacts().map(contact => contact.name),
        ...accounts[networkIdentifier].map(account => account.name),
    ];
    const existedAddresses = [
        ...addressBook.getAllContacts().map(contact => contact.address),
        ...accounts[networkIdentifier].map(account => account.address),
    ];
    const [list, setList] = useProp(props.route.params?.list, 'whitelist');
    const [name, setName] = useProp(props.route.params?.name, '');
    const [address, setAddress] = useProp(props.route.params?.address, '');
    const [notes, setNotes] = useState('');
    const nameErrorMessage = useValidation(name, [validateRequired(), validateAccountName(), validateExisted(existedNames)], $t);
    const addressErrorMessage = useValidation(address, [validateRequired(), validateAddress(), validateExisted(existedAddresses)], $t);
    const isButtonDisabled = !!nameErrorMessage || !!addressErrorMessage;
    const listOptions = [{
        label: 'Whitelist',
        value: 'whitelist'
    }, {
        label: 'Blacklist',
        value: 'blacklist'
    }]

    const [saveContact] = useDataManager(async () => {
        await store.dispatchAction({type: 'addressBook/addContact', payload: { 
            name,
            address,
            notes,
            isBlackListed: list === 'blacklist'
        }});
        Router.goBack();
    }, null, handleError);
   

    {/* notranslate */}
    return (
        <Screen bottomComponent={
            <FormItem>
                <Button title="Save" isDisabled={isButtonDisabled} onPress={saveContact} />
            </FormItem>
        }>
            <FormItem>
                {/* notranslate */}
                <Dropdown title="List" list={listOptions} value={list} onChange={setList} />
            </FormItem>
            <FormItem>
                {/* notranslate */}
                <TextBox title="Name" errorMessage={nameErrorMessage} value={name} onChange={setName} />
            </FormItem>
            <FormItem>
                {/* notranslate */}
                <TextBox title="Address" errorMessage={addressErrorMessage} value={address} onChange={setAddress} />
            </FormItem>
            <FormItem>
                {/* notranslate */}
                <TextBox title="Notes" value={notes} onChange={setNotes} />
            </FormItem>
        </Screen>
    );
});
