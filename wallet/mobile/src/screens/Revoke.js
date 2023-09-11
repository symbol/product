import React from 'react';
import { useMemo } from 'react';
import { useEffect } from 'react';
import { useState } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import {
    Alert,
    Button,
    DialogBox,
    FeeSelector,
    FormItem,
    InputAddress,
    InputAmount,
    Screen,
    SelectMosaic,
    StyledText,
    TableView,
} from 'src/components';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import { AccountService, MosaicService, TransactionService } from 'src/services';
import { connect } from 'src/store';
import { getMosaicWithRelativeAmount, getTransactionFees, handleError, useDataManager, usePasscode, useProp, useToggle } from 'src/utils';

export const Revoke = connect((state) => ({
    currentAccount: state.account.current,
    cosignatories: state.account.cosignatories,
    isMultisigAccount: state.account.isMultisig,
    isAccountReady: state.account.isReady,
    networkProperties: state.network.networkProperties,
    ticker: state.network.ticker,
    chainHeight: state.network.chainHeight,
}))(function Revoke(props) {
    const { currentAccount, cosignatories, isMultisigAccount, isAccountReady, networkProperties, ticker, chainHeight, route } = props;
    const { mosaics } = route.params;
    const [sourceAddress, setSourceAddress] = useProp(route.params.sourceAddress || '');
    const [mosaicId, setMosaicId] = useProp(mosaics[0].id);
    const [selectedMosaic, setSelectedMosaic] = useState({});
    const [amount, setAmount] = useProp('0');
    const [maxFee, setMaxFee] = useState(0);
    const [speed, setSpeed] = useState('medium');
    const [isConfirmVisible, toggleConfirm] = useToggle(false);
    const [isSuccessAlertVisible, toggleSuccessAlert] = useToggle(false);
    const [isAmountValid, setAmountValid] = useState(false);
    const [isSourceAddressValid, setSourceAddressValid] = useState(false);
    const mosaicOptions = mosaics.map((mosaic) => ({
        label: mosaic.name,
        value: mosaic.id,
        mosaicInfo: selectedMosaic,
    }));

    const isButtonDisabled = !isSourceAddressValid || !isAmountValid;

    const transaction = {
        signerAddress: currentAccount.address,
        sourceAddress: sourceAddress,
        mosaic: {
            ...selectedMosaic,
            amount: parseFloat(amount || 0),
        },
        fee: maxFee,
    };

    const cosignatoryList = { cosignatories };

    const transactionSize = 700;
    const transactionFees = useMemo(() => getTransactionFees({}, networkProperties, transactionSize), []);

    const [fetchSourceAddressMosaicBalance, isBalanceLoading] = useDataManager(
        async () => {
            const { mosaics } = await AccountService.fetchAccountInfo(networkProperties, sourceAddress);
            const mosaic = mosaics.find((mosaic) => mosaic.id === mosaicId);

            if (!mosaic) {
                setSelectedMosaic({});
                return;
            }

            const mosaicInfo = await MosaicService.fetchMosaicInfo(networkProperties, mosaicId);
            const formattedMosaic = getMosaicWithRelativeAmount(mosaic, mosaicInfo);
            setSelectedMosaic(formattedMosaic);
        },
        null,
        (e) => {
            handleError(e);
            setSelectedMosaic({});
        }
    );
    const [send] = useDataManager(
        async () => {
            await TransactionService.sendRevokeTransaction(transaction, currentAccount, networkProperties);
            toggleSuccessAlert();
        },
        null,
        handleError
    );
    const confirmSend = usePasscode('enter', send);
    const handleConfirmPress = () => {
        toggleConfirm();
        confirmSend();
    };
    const handleMosaicChange = (mosaicId) => {
        setMosaicId(mosaicId);
        setAmount('0');
    };

    useEffect(() => {
        if (transactionFees.medium) {
            setMaxFee(transactionFees[speed]);
        }
    }, [transactionFees, speed]);
    useEffect(() => {
        if (isSourceAddressValid) {
            fetchSourceAddressMosaicBalance();
        }
    }, [sourceAddress, isSourceAddressValid]);

    return (
        <Screen
            isLoading={!isAccountReady || isBalanceLoading}
            bottomComponent={
                <FormItem>
                    <Button title={$t('button_revoke')} isDisabled={isButtonDisabled} onPress={toggleConfirm} />
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
                                title={$t('input_sourceAddress')}
                                value={sourceAddress}
                                onChange={setSourceAddress}
                                onValidityChange={setSourceAddressValid}
                            />
                        </FormItem>
                        <FormItem>
                            <SelectMosaic
                                title={$t('input_mosaic')}
                                value={mosaicId}
                                list={mosaicOptions}
                                chainHeight={chainHeight}
                                onChange={handleMosaicChange}
                            />
                        </FormItem>
                        <FormItem>
                            <InputAmount
                                title={$t('input_amount')}
                                availableBalance={selectedMosaic.amount}
                                value={amount}
                                onChange={setAmount}
                                onValidityChange={setAmountValid}
                            />
                        </FormItem>
                        <FormItem>
                            <FeeSelector
                                title={$t('input_feeSpeed')}
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
                title={$t('transaction_confirm_title')}
                body={<TableView data={transaction} />}
                isVisible={isConfirmVisible}
                onSuccess={handleConfirmPress}
                onCancel={toggleConfirm}
            />
            <DialogBox
                type="alert"
                title={$t('transaction_success_title')}
                text={$t('transaction_success_text')}
                isVisible={isSuccessAlertVisible}
                onSuccess={Router.goToHome}
            />
        </Screen>
    );
});
