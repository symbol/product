import React, { useState } from 'react';
import { Screen, FormItem, StyledText, TextBox, Button } from 'src/components';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import store, { connect } from 'src/store';
import { handleError, useDataManager, useProp, useValidation, validateAccountName, validateKey, validateRequired } from 'src/utils';

export const AddExternalAccount = connect(state => ({
    networkIdentifier: state.network.networkIdentifier,
}))(function AddExternalAccount(props) {
    const { networkIdentifier, route } = props;
    const [accountName, setAccountName] = useState('');
    const [privateKey, setPrivateKey] = useProp(route.params?.privateKey, '');
    const nameErrorMessage = useValidation(accountName, [validateRequired(), validateAccountName()], $t);
    const privateKeyErrorMessage = useValidation(privateKey, [validateRequired(), validateKey()], $t);

    const [addAccount, isAddAccountLoading] = useDataManager(async () => {
        const name = accountName;
        await store.dispatchAction({type: 'wallet/addExternalAccount', payload: { privateKey, name, networkIdentifier }});
        await store.dispatchAction({type: 'wallet/loadAll'});
        await store.dispatchAction({type: 'account/fetchData'});
        Router.goToHome();
    }, null, handleError);
   
    const isLoading = isAddAccountLoading;
    const isButtonDisabled = !!nameErrorMessage || !!privateKeyErrorMessage;

    return (
        <Screen isLoading={isLoading} bottomComponent={
            <FormItem>
                <Button title={$t('button_addAccount')} isDisabled={isButtonDisabled} onPress={addAccount} />
            </FormItem>
        }>
            <FormItem>
                <StyledText type="title">{$t('s_addAccount_name_title')}</StyledText>
                <TextBox 
                    title={$t('s_addAccount_name_input')} 
                    errorMessage={nameErrorMessage} 
                    value={accountName} 
                    onChange={setAccountName} 
                />
            </FormItem>
            <FormItem>
                <StyledText type="title">{$t('s_addAccount_privateKey_title')}</StyledText>
                <StyledText type="body">{$t('s_addAccount_privateKey_description')}</StyledText>
            </FormItem>
            <FormItem>
                <TextBox 
                    title={$t('s_addAccount_privateKey_input')} 
                    errorMessage={privateKeyErrorMessage} 
                    value={privateKey} 
                    onChange={setPrivateKey} 
                />
            </FormItem>
        </Screen>
    );
});
