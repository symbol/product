import React, { useState } from 'react';
import { Screen, FormItem, StyledText, TextBox, Button } from 'src/components';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import store, { connect } from 'src/store';
import { handleError, useDataManager, useValidation, validateAccountName, validateKey, validateRequired } from 'src/utils';

export const AddExternalAccount = connect(state => ({
    networkIdentifier: state.network.networkIdentifier,
}))(function AddExternalAccount(props) {
    const { networkIdentifier } = props;
    const [accountName, setAccountName] = useState('');
    const [privateKey, setPrivateKey] = useState('');
    const nameErrorMessage = useValidation(accountName, [validateRequired(), validateAccountName()], $t);
    const privateKeyErrorMessage = useValidation(privateKey, [validateRequired(), validateKey()], $t);
   
    // notranslate
    const defaultAccountName = 'External Account';

    const [addAccount, isAddAccountLoading] = useDataManager(async () => {
        const name = (!nameErrorMessage && accountName) || defaultAccountName;
        await store.dispatchAction({type: 'wallet/addExternalAccount', payload: { privateKey, name, networkIdentifier }});
        await store.dispatchAction({type: 'wallet/loadAll'});
        await store.dispatchAction({type: 'account/fetchData'});
        Router.goBack();
    }, null, handleError);
   
    const isLoading = isAddAccountLoading;
    const isButtonDisabled = !!nameErrorMessage || !!privateKeyErrorMessage;

    {/* notranslate */}
    return (
        <Screen isLoading={isLoading} bottomComponent={
            <FormItem>
                <Button title="Add Account" isDisabled={isButtonDisabled} onPress={addAccount} />
            </FormItem>
        }>
            <FormItem>
                {/* notranslate */}
                <StyledText type="title">Give a Name for New Account</StyledText>
                {/* notranslate */}
                <TextBox title="Name" errorMessage={nameErrorMessage} value={accountName} onChange={setAccountName} />
            </FormItem>
            <FormItem>
                {/* notranslate */}
                <StyledText type="title">Account Private Key</StyledText>
                {/* notranslate */}
                <StyledText type="body">Please make sure that the private key is securely backed up and you will be able to access it. Note that this account cannot be restored from you mnemonic backup phrase.</StyledText>
            </FormItem>
            <FormItem>
                {/* notranslate */}
                <TextBox title="Private Key" errorMessage={privateKeyErrorMessage} value={privateKey} onChange={setPrivateKey} />
            </FormItem>
        </Screen>
    );
});
