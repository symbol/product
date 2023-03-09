import React from 'react';
import { useMemo } from 'react';
import { useEffect } from 'react';
import { useState } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import {
    Alert,
    Button,
    Checkbox,
    DialogBox,
    FeeSelector,
    FormItem,
    InputAddress,
    InputAmount,
    Screen,
    SelectMosaic,
    StyledText,
    TableView,
    TextBox,
} from 'src/components';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import { TransactionService } from 'src/services';
import { connect } from 'src/store';
import { getTransactionFees, handleError, toFixedNumber, useDataManager, usePasscode, useProp, useToggle } from 'src/utils';

export const Send = connect((state) => ({
    currentAccount: state.account.current,
    cosignatories: state.account.cosignatories,
    isMultisigAccount: state.account.isMultisig,
    isAccountReady: state.account.isReady,
    mosaics: state.account.mosaics,
    mosaicInfos: state.wallet.mosaicInfos,
    networkProperties: state.network.networkProperties,
    ticker: state.network.ticker,
    chainHeight: state.network.chainHeight,
}))(function Send(props) {
    const {
        currentAccount,
        cosignatories,
        isMultisigAccount,
        isAccountReady,
        mosaics,
        networkProperties,
        ticker,
        chainHeight,
        route,
    } = props;
    const [recipient, setRecipient] = useProp(route.params?.recipientAddress || '');
    const [mosaicId, setMosaicId] = useProp(route.params?.mosaicId, mosaics[0]?.id);
    const [amount, setAmount] = useProp(route.params?.amount, '0');
    const [message, setMessage] = useProp(route.params?.message?.text, '');
    const [isEncrypted, toggleEncrypted] = useToggle(false);
    const [maxFee, setMaxFee] = useState(0);
    const [speed, setSpeed] = useState('medium');
    const [isConfirmVisible, toggleConfirm] = useToggle(false);
    const [isSuccessAlertVisible, toggleSuccessAlert] = useToggle(false);
    const [isAmountValid, setAmountValid] = useState(false);
    const [isRecipientValid, setRecipientValid] = useState(false);

    const mosaicOptions = mosaics.map((mosaic) => ({
        label: mosaic.name,
        value: mosaic.id,
        mosaicInfo: mosaic,
    }));
    const selectedMosaic = mosaics.find((mosaic) => mosaic.id === mosaicId);
    const selectedMosaicBalance = selectedMosaic?.amount || 0;
    const selectedMosaicDivisibility = selectedMosaic?.divisibility || 0;
    const availableBalance = Math.max(0, toFixedNumber(selectedMosaicBalance - parseFloat(maxFee), selectedMosaicDivisibility));

    const isButtonDisabled = !isRecipientValid || !isAmountValid || !selectedMosaic;

    const transaction = {
        signerAddress: currentAccount.address,
        recipientAddress: recipient,
        mosaics: selectedMosaic
            ? [
                  {
                      ...selectedMosaic,
                      amount: parseFloat(amount),
                  },
              ]
            : [],
        messageText: message ? message : null,
        messageEncrypted: message ? isEncrypted : null,
        fee: maxFee,
    };

    const cosignatoryList = { cosignatories };

    const transactionFees = useMemo(() => getTransactionFees(transaction, networkProperties), [message, isEncrypted]);

    const [send] = useDataManager(
        async () => {
            await TransactionService.sendTransferTransaction(transaction, currentAccount, networkProperties);
            toggleSuccessAlert();
        },
        null,
        handleError
    );
    const confirmSend = usePasscode('enter', send);
    const handleConfirmPress = () => {
        toggleConfirm();
        confirmSend();
    }

    useEffect(() => {
        if (transactionFees.medium) {
            setMaxFee(transactionFees[speed]);
        }
    }, [transactionFees, speed]);

    useEffect(() => {
        if (!mosaicId) {
            setMosaicId(mosaics[0]?.id);
        }
    }, [isAccountReady, mosaicId]);

    return (
        <Screen
            isLoading={!isAccountReady}
            bottomComponent={
                <FormItem>
                    <Button title={$t('button_send')} isDisabled={isButtonDisabled} onPress={toggleConfirm} />
                </FormItem>
            }
        >
            <ScrollView>
                {isMultisigAccount && (
                    <>
                        <FormItem>
                            <Alert type="warning" title={$t('warning_multisig_title')} body={$t('warning_multisig_body')} />
                        </FormItem>
                        <FormItem>
                            <TableView data={cosignatoryList} />
                        </FormItem>
                    </>
                )}
                {!isMultisigAccount && (
                    <>
                        <FormItem>
                            <StyledText type="title">{$t('form_transfer_title')}</StyledText>
                            <StyledText type="body">{$t('s_send_description')}</StyledText>
                        </FormItem>
                        <FormItem>
                            <InputAddress
                                title={$t('form_transfer_input_recipient')}
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
                            <TextBox title={$t('form_transfer_input_message')} value={message} onChange={setMessage} />
                        </FormItem>
                        <FormItem>
                            <Checkbox title={$t('form_transfer_input_encrypted')} value={isEncrypted} onChange={toggleEncrypted} />
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
                    </>
                )}
            </ScrollView>
            <DialogBox
                type="confirm"
                title={$t('form_transfer_confirm_title')}
                body={<TableView data={transaction} />}
                isVisible={isConfirmVisible}
                onSuccess={handleConfirmPress}
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
