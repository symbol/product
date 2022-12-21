import React from 'react';
import { useState } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import { TableView, Screen, FormItem, TextBox, Checkbox, Dropdown, Button, StyledText, InputAmount, DialogBox } from 'src/components';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import { connect } from 'src/store';
import { getMosaicsWithRelativeAmounts, getTransactionFees, usePasscode, useToggle, useValidation, validateAmount, validateRequired, validateUnresolvedAddress } from 'src/utils';

export const Send = connect(state => ({
    currentAccount: state.account.current,
    mosaics: state.account.mosaics,
    mosaicInfos: state.wallet.mosaicInfos,
    networkProperties: state.network.networkProperties,
}))(function Send(props) {
    const { currentAccount, mosaics, networkProperties } = props;
    const [recipient, setRecipient] = useState('');
    const [mosaicId, setMosaicId] = useState(mosaics[0]?.id);
    const [amount, setAmount] = useState('0');
    const [message, setMessage] = useState('');
    const [isEncrypted, toggleEncrypted] = useToggle(false);
    const [maxFee, setMaxFee] = useState('0');
    const [isConfirmVisible, toggleConfirm] = useToggle(false);

    const mosaicList = mosaics.map(mosaic => ({label: mosaic.name, value: mosaic.id}));
    const selectedMosaic = mosaics.find(mosaic => mosaic.id === mosaicId);
    const selectedMosaicBalance = selectedMosaic?.amount || 0;
    const availableBalance = Math.max(0, selectedMosaicBalance - parseFloat(maxFee));

    const transaction = {
        signerAddress: currentAccount.address,
        recipientAddress: recipient,
        mosaics: selectedMosaic ? [{
            ...selectedMosaic,
           amount: parseFloat(amount)
        }] : [],
        messageText: message,
        messageEncrypted: isEncrypted,
        fee: maxFee
    };
    console.log('transaction', transaction)

    const transactionFees = getTransactionFees(transaction, networkProperties);
    
    const recipientErrorMessage = useValidation(recipient, [validateRequired(), validateUnresolvedAddress()], $t);
    const [isAmountValid, setAmountValid] = useState(true);
    const isButtonDisabled = !!recipientErrorMessage || !isAmountValid || !selectedMosaic;

    const send = () => {};
    const confirmSend = usePasscode('enter', send, Router.goBack);

    return (
        <Screen
            bottomComponent={<Button title="Send" isDisabled={isButtonDisabled} onPress={toggleConfirm} />}
        >
            <ScrollView>
                <FormItem>
                    <StyledText type="title">{$t('form_transfer_title')}</StyledText>
                </FormItem>
                <FormItem>
                    <TextBox
                        title={$t('form_transfer_input_recipient')} 
                        errorMessage={recipientErrorMessage} 
                        value={recipient} 
                        onChange={setRecipient} 
                />
                </FormItem>
                <FormItem>
                    <Dropdown
                        title={$t('form_transfer_input_mosaic')} 
                        value={mosaicId} 
                        list={mosaicList} 
                        onChange={setMosaicId} 
                    />
                </FormItem>
                <FormItem>
                    <InputAmount 
                        title={$t('form_transfer_input_amount')} 
                        availableBalance={availableBalance}
                        value={amount} 
                        onChange={setAmount}
                        onValidityChange={setAmountValid}
                    />
                </FormItem>
                <FormItem>
                    <TextBox
                        title={$t('form_transfer_input_message')} 
                        value={message} 
                        onChange={setMessage} 
                    />
                </FormItem>
                <FormItem>
                    <Checkbox
                        title={$t('form_transfer_input_encrypted')} 
                        value={isEncrypted} 
                        onChange={toggleEncrypted} 
                    />
                </FormItem>
                <FormItem>
                    <TextBox 
                        title={$t('form_transfer_input_fee') + ` F: ${transactionFees.fast}, M: ${transactionFees.medium}`} 
                        value={maxFee} 
                        onChange={setMaxFee} 
                    />
                </FormItem>
            </ScrollView>
            <DialogBox 
                type="confirm" 
                title={$t('form_transfer_confirm_title')}
                body={<TableView data={transaction} />}
                isVisible={isConfirmVisible} 
                onSuccess={confirmSend} 
                onCancel={toggleConfirm} 
            />
        </Screen>
    );
});
