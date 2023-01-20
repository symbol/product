import React, { useState } from 'react';
import { Screen, FormItem, StyledText, TextBox, Button, Dropdown } from 'src/components';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import store, { connect } from 'src/store';
import { handleError, useDataManager, useProp, useValidation, validateAccountName, validateRequired, validateAddress, validateExisted } from 'src/utils';

export const AddressBookEdit = connect(state => ({
    accounts: state.wallet.accounts,
    addressBookWhiteList: state.addressBook.whiteList,
    addressBookBlackList: state.addressBook.blackList,
    networkIdentifier: state.network.networkIdentifier
}))(function AddressBookEdit(props) {
    const { accounts, addressBookWhiteList, addressBookBlackList, networkIdentifier, route } = props;
    const allContacts = [
        ...addressBookWhiteList,
        ...addressBookBlackList,
        ...accounts[networkIdentifier]
    ];
    const [list, setList] = useProp(route.params?.list, 'whitelist');
    const [name, setName] = useProp(route.params?.name, '');
    const [address, setAddress] = useProp(route.params?.address, '');
    const [notes, setNotes] = useProp(route.params?.notes, '');
    const existedNames = allContacts
        .map(contact => contact.name)
        .filter(el => el !== name);
    const existedAddresses = allContacts
        .map(contact => contact.address)
        .filter(el => el !== address);
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
        console.log(route.params?.type === 'edit'
        ? 'addressBook/updateContact'
        : 'addressBook/addContact', route.params)
        const action = route.params?.type === 'edit'
            ? 'addressBook/updateContact'
            : 'addressBook/addContact';
        await store.dispatchAction({type: action, payload: {
            id: route.params?.id,
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
