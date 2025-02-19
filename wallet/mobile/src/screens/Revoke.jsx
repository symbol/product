import React from 'react';
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
} from '@/app/components';
import { $t } from '@/app/localization';
import { Router } from '@/app/Router';
import { AccountService, MosaicService } from '@/app/lib/services';
import { getMosaicWithRelativeAmount, handleError } from '@/app/utils';
import { useDataManager, usePasscode, useProp, useToggle, useTransactionFees } from '@/app/hooks';
import { TransactionType } from '@/app/constants';
import WalletController from '@/app/lib/controller/MobileWalletController';
import { observer } from 'mobx-react-lite';

export const Revoke = observer(function Revoke(props) {
    const { route } = props;
    const { currentAccount, currentAccountInfo, isWalletReady, networkProperties, ticker, chainHeight } = WalletController;
    const { mosaics } = route.params;
    const [sourceAddress, setSourceAddress] = useProp(route.params.sourceAddress || '');
    const [mosaicId, setMosaicId] = useProp(mosaics[0].id);
    const [selectedMosaic, setSelectedMosaic] = useState({ id: '0000000000000000' });
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

    const isButtonDisabled = !isSourceAddressValid || !isAmountValid || !selectedMosaic.amount || !+amount;

    const transaction = {
        type: TransactionType.MOSAIC_SUPPLY_REVOCATION,
        signerAddress: currentAccount.address,
        sourceAddress: sourceAddress,
        mosaic: {
            ...selectedMosaic,
            amount: parseFloat(amount || 0),
        },
        fee: maxFee,
    };
    const cosignatoryList = { cosignatories: currentAccountInfo.cosignatories };
    const transactionFees = useTransactionFees(transaction, networkProperties);

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
        async (password) => {
            await WalletController.signAndAnnounceTransaction(transaction, true, password);
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
            isLoading={!isWalletReady || isBalanceLoading}
            bottomComponent={
                <FormItem>
                    <Button title={$t('button_revoke')} isDisabled={isButtonDisabled} onPress={toggleConfirm} />
                </FormItem>
            }
        >
            <ScrollView>
                {currentAccountInfo.isMultisig && (
                    <>
                        <FormItem>
                            <Alert type="warning" title={$t('warning_multisig_title')} body={$t('warning_multisig_body')} />
                        </FormItem>
                        <FormItem>
                            <TableView data={cosignatoryList} />
                        </FormItem>
                    </>
                )}
                {!currentAccountInfo.isMultisig && (
                    <>
                        <FormItem>
                            <StyledText type="body">{$t('s_revoke_description')}</StyledText>
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
                                availableBalance={selectedMosaic.amount || 0}
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
