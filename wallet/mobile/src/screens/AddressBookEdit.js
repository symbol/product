import React from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import { Button, Dropdown, FormItem, Screen, StyledText, TextBox } from 'src/components';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import {
    handleError,
    useDataManager,
    useProp,
    useValidation,
    validateAccountName,
    validateAddress,
    validateExisted,
    validateRequired,
} from 'src/utils';
import WalletController from 'src/lib/controller/MobileWalletController';
import { observer } from 'mobx-react-lite';

export const AddressBookEdit = observer(function AddressBookEdit(props) {
    const { route } = props;
    const { accounts, networkIdentifier } = WalletController;
    const { addressBook } = WalletController.modules;
    const allContacts = [...addressBook.contacts, ...accounts[networkIdentifier]];
    const isEdit = route.params?.type === 'edit';
    const [list, setList] = useProp(route.params?.list, 'whitelist');
    const [name, setName] = useProp(route.params?.name, '');
    const [address, setAddress] = useProp(route.params?.address, '');
    const [notes, setNotes] = useProp(route.params?.notes, '');
    const nameToExclude = isEdit ? route.params?.name : '';
    const addressToExclude = isEdit ? route.params?.address : '';
    const existedNames = allContacts.map((contact) => contact.name).filter((el) => el !== nameToExclude);
    const existedAddresses = allContacts.map((contact) => contact.address).filter((el) => el !== addressToExclude);
    const isNameRequired = list === 'whitelist';
    const nameErrorMessage = useValidation(
        name,
        [validateRequired(isNameRequired), validateAccountName(), validateExisted(existedNames)],
        $t
    );
    const addressErrorMessage = useValidation(address, [validateRequired(), validateAddress(), validateExisted(existedAddresses)], $t);
    const isButtonDisabled = !!nameErrorMessage || !!addressErrorMessage;
    const titleText = isEdit ? $t('s_addressBook_manage_title_edit') : $t('s_addressBook_manage_title_add');
    const descriptionText = isEdit ? '' : $t('s_addressBook_manage_description_add');
    const listOptions = [
        {
            label: $t('s_addressBook_whitelist'),
            value: 'whitelist',
        },
        {
            label: $t('s_addressBook_blacklist'),
            value: 'blacklist',
        },
    ];

    const [saveContact, isLoading] = useDataManager(
        async () => {
            const newContact = {
                id: route.params?.id,
                name: name ? name : $t('s_addressBook_account_blacklist_defaultName'),
                address,
                notes,
                isBlackListed: list === 'blacklist',
            };

            if (isEdit) await addressBook.updateContact(newContact);
            else await addressBook.addContact(newContact);
            Router.goBack();
        },
        null,
        handleError
    );

    return (
        <Screen
            isLoading={isLoading}
            bottomComponent={
                <FormItem>
                    <Button title={$t('button_save')} isDisabled={isButtonDisabled} onPress={saveContact} />
                </FormItem>
            }
        >
            <ScrollView>
                <FormItem>
                    <StyledText type="title">{titleText}</StyledText>
                    <StyledText type="body">{descriptionText}</StyledText>
                </FormItem>
                <FormItem>
                    <Dropdown title={$t('s_addressBook_list')} list={listOptions} value={list} onChange={setList} />
                </FormItem>
                <FormItem>
                    <TextBox title={$t('input_name')} errorMessage={nameErrorMessage} value={name} onChange={setName} />
                </FormItem>
                <FormItem>
                    <TextBox title={$t('input_address')} errorMessage={addressErrorMessage} value={address} onChange={setAddress} />
                </FormItem>
                <FormItem>
                    <TextBox title={$t('input_notes')} value={notes} onChange={setNotes} />
                </FormItem>
            </ScrollView>
        </Screen>
    );
});
