import React from 'react';
import { useState } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import { TableView, Screen, FormItem, TextBox, Checkbox, Dropdown, Button, StyledText, InputAmount } from 'src/components';
import { connect } from 'src/store';
import { getMosaicsWithRelativeAmounts, useToggle, useValidation, validateAmount, validateRequired, validateUnresolvedAddress } from 'src/utils';

export const Send = connect(state => ({
    currentAccount: state.account.current,
    mosaics: state.account.mosaics,
    mosaicInfos: state.wallet.mosaicInfos,
    networkIdentifier: state.network.networkIdentifier,
}))(function Send(props) {
    const { currentAccount, mosaics, mosaicInfos, networkIdentifier } = props;
    const [recipient, setRecipient] = useState('');
    const [mosaicId, setMosaicId] = useState(mosaics[0]?.id);
    const [amount, setAmount] = useState('0');
    const [message, setMessage] = useState('');
    const [isEncrypted, toggleEncrypted] = useToggle(false);
    const [maxFee, setMaxFee] = useState('0');

    const formattedMosaics = getMosaicsWithRelativeAmounts(mosaics, mosaicInfos[networkIdentifier]);
    const mosaicList = formattedMosaics.map(mosaic => ({label: mosaic.name, value: mosaic.id}));
    const selectedMosaicBalance = formattedMosaics.find(mosaic => mosaic.id === mosaicId)?.amount || 0;
    const availableBalance = selectedMosaicBalance - parseFloat(maxFee);
    
    const recipientErrorMessage = useValidation(recipient, [validateRequired(), validateUnresolvedAddress()]);
    const [isAmountValid, setAmountValid] = useState(true);
    const isButtonDisabled = !!recipientErrorMessage || !isAmountValid;
    
    return (
        <Screen
            bottomComponent={<Button title="Send" isDisabled={isButtonDisabled} onPress={() => {}} />}
        >
            <ScrollView>
                <FormItem>
                    <StyledText type="title">Transfer</StyledText>
                </FormItem>
                <FormItem>
                    <TextBox
                        // notranslate
                        title="Recipient" 
                        errorMessage={recipientErrorMessage} 
                        value={recipient} 
                        onChange={setRecipient} 
                />
                </FormItem>
                <FormItem>
                    <Dropdown
                        // notranslate
                        title="Mosaic" 
                        value={mosaicId} 
                        list={mosaicList} 
                        onChange={setMosaicId} 
                    />
                </FormItem>
                <FormItem>
                    <InputAmount 
                        // notranslate
                        title="Amount"
                        availableBalance={availableBalance}
                        value={amount} 
                        onChange={setAmount}
                        onValidityChange={setAmountValid}
                    />
                </FormItem>
                <FormItem>
                    <TextBox
                        // notranslate
                        title="Message/Memo" 
                        value={message} 
                        onChange={setMessage} 
                    />
                </FormItem>
                <FormItem>
                    <Checkbox
                        // notranslate 
                        title="Encrypted" 
                        value={isEncrypted} 
                        onChange={toggleEncrypted} 
                    />
                </FormItem>
                <FormItem>
                    <TextBox 
                        // notranslate
                        title="Fee" 
                        value={maxFee} 
                        onChange={setMaxFee} 
                    />
                </FormItem>
            </ScrollView>
        </Screen>
    );
});
