import React from 'react';
import { useMemo } from 'react';
import { useEffect } from 'react';
import { useState } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import { TableView, Screen, SelectMosaic, FeeSelector, FormItem, TextBox, Checkbox, Button, StyledText, InputAmount, DialogBox, InputAddress } from 'src/components';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import { TransactionService } from 'src/services';
import store, { connect } from 'src/store';
import { getTransactionFees, handleError, toFixedNumber, useDataManager, usePasscode, useProp, useToggle } from 'src/utils';

export const Send = connect(state => ({
    accounts: state.wallet.accounts,
    addressBookWhiteList: state.addressBook.whiteList,
    currentAccount: state.account.current,
    mosaics: state.account.mosaics,
    mosaicInfos: state.wallet.mosaicInfos,
    networkIdentifier: state.network.networkIdentifier,
    networkProperties: state.network.networkProperties,
    ticker: state.network.ticker,
    chainHeight: state.network.chainHeight
}))(function Send(props) {
    const { accounts, addressBookWhiteList, currentAccount, mosaics, networkIdentifier, networkProperties, ticker, chainHeight, route } = props;
    const [recipient, setRecipient] = useProp(route.params?.recipientAddress || '');
    const [mosaicId, setMosaicId] = useState(mosaics[0]?.id);
    const [amount, setAmount] = useState('0');
    const [message, setMessage] = useState('');
    const [isEncrypted, toggleEncrypted] = useToggle(false);
    const [maxFee, setMaxFee] = useState(0);
    const [speed, setSpeed] = useState('medium');
    const [isConfirmVisible, toggleConfirm] = useToggle(false);
    const [isSuccessAlertVisible, toggleSuccessAlert] = useToggle(false);

    const networkAccounts = accounts[networkIdentifier];
    const contacts = [...networkAccounts, ...addressBookWhiteList];
    const mosaicOptions = mosaics.map(mosaic => ({
        label: mosaic.name, 
        value: mosaic.id, 
        mosaicInfo: mosaic
    }));
    const selectedMosaic = mosaics.find(mosaic => mosaic.id === mosaicId);
    const selectedMosaicBalance = selectedMosaic?.amount || 0;
    const selectedMosaicDivisibility = selectedMosaic?.divisibility || 0;
    const availableBalance = Math.max(
        0, 
        toFixedNumber(selectedMosaicBalance - parseFloat(maxFee), selectedMosaicDivisibility)
    );

    const transaction = {
        signerAddress: currentAccount.address,
        recipientAddress: recipient,
        mosaics: selectedMosaic ? [{
            ...selectedMosaic,
           amount: parseFloat(amount)
        }] : [],
        messageText: message ? message : null,
        messageEncrypted: message ? isEncrypted : null,
        fee: maxFee
    };

    const transactionFees = useMemo(() => getTransactionFees(transaction, networkProperties), [message, isEncrypted]);
    
    const [isAmountValid, setAmountValid] = useState(true);
    const [isRecipientValid, setRecipientValid] = useState(true);
    const isButtonDisabled = !isRecipientValid || !isAmountValid || !selectedMosaic;

    const [send] = useDataManager(async () => {
        await TransactionService.sendTransferTransaction(transaction, currentAccount, networkProperties);
        toggleSuccessAlert();
    }, null, handleError);
    const confirmSend = usePasscode('enter', send, Router.goBack);
    
    useEffect(() => {
        if (transactionFees.medium) {
            setMaxFee(transactionFees[speed]);
        }
    }, [transactionFees, speed]);

    return (
        <Screen bottomComponent={
            <FormItem>
                <Button title={$t('button_send')} isDisabled={isButtonDisabled} onPress={toggleConfirm} />
            </FormItem>
        }>
            <ScrollView>
                <FormItem>
                    <StyledText type="title">{$t('form_transfer_title')}</StyledText>
                    <StyledText type="body">{$t('s_send_description')}</StyledText>
                </FormItem>
                <FormItem>
                    <InputAddress 
                        title={$t('form_transfer_input_recipient')} 
                        contacts={contacts}
                        value={recipient} 
                        onChange={setRecipient}
                        onValidityChange={setRecipientValid}
                    />
                </FormItem>
                <FormItem>
                    <SelectMosaic
                        title={$t('form_transfer_input_mosaic')} 
                        value={mosaicId} 
                        list={mosaicOptions} 
                        chainHeight={chainHeight}
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
                    <FeeSelector 
                        title={$t('form_transfer_input_fee')} 
                        value={speed}
                        fees={transactionFees}
                        ticker={ticker}
                        onChange={setSpeed} 
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
            <DialogBox 
                type="alert" 
                title={$t('form_transfer_success_title')}
                text={$t('form_transfer_success_text')}
                isVisible={isSuccessAlertVisible} 
                onSuccess={Router.goToHome} 
            />
        </Screen>
    );
});
