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
    Screen,
    StyledText,
    TableView,
    TextBox,
    Widget,
} from '@/app/components';
import { $t } from '@/app/localization';
import { Router } from '@/app/Router';
import { NetworkService, TransactionService } from '@/app/lib/services';
import { layout } from '@/app/styles';
import {
    generateMosaicId,
    generateNonce,
    getTransactionFees,
    handleError,
    validateMosaicDivisibility,
    validateMosaicDuration,
    validateMosaicSupply,
    validateRequired,
} from '@/app/utils';
import { useDataManager, useInit, usePasscode, useToggle, useValidation } from '@/app/hooks';
import WalletController from '@/app/lib/controller/MobileWalletController';
import { observer } from 'mobx-react-lite';

export const MosaicCreation = observer(function MosaicCreation() {
    const { currentAccount, currentAccountInfo, isWalletReady, networkProperties, ticker } = WalletController;
    const isMultisigAccount = currentAccountInfo.isMultisig;
    const [nonce, setNonce] = useState('');
    const [mosaicId, setMosaicId] = useState('');
    const [isSupplyMutable, toggleIsSupplyMutable] = useToggle(false);
    const [isTransferable, toggleIsTransferable] = useToggle(true);
    const [isRestrictable, toggleIsRestrictable] = useToggle(false);
    const [isRevokable, toggleIsRevokable] = useToggle(false);
    const [isExpiring, toggleIsExpiring] = useToggle(true);
    const [divisibility, setDivisibility] = useState('2');
    const [supply, setSupply] = useState('1000');
    const [duration, setDuration] = useState('10000');
    const [rentalFee, setRentalFee] = useState(0);
    const [maxFee, setMaxFee] = useState(0);
    const [speed, setSpeed] = useState('medium');
    const [isConfirmVisible, toggleConfirm] = useToggle(false);
    const [isSuccessAlertVisible, toggleSuccessAlert] = useToggle(false);
    const supplyErrorMessage = useValidation(supply, [validateRequired(), validateMosaicSupply()], $t);
    const divisibilityErrorMessage = useValidation(divisibility, [validateRequired(), validateMosaicDivisibility()], $t);
    const durationErrorMessage = useValidation(
        duration,
        [validateRequired(), validateMosaicDuration(networkProperties?.blockGenerationTargetTime)],
        $t
    );
    const isButtonDisabled = !!supplyErrorMessage || !!divisibilityErrorMessage;

    const transaction = {
        signerAddress: currentAccount.address,
        fee: maxFee,
        rentalFee,
        supply: parseInt(supply || 0),
        divisibility: parseInt(divisibility || 0),
        duration: isExpiring ? +duration : 0,
        mosaicId,
        nonce,
        isSupplyMutable,
        isTransferable,
        isRestrictable,
        isRevokable,
    };

    const transactionSize = 700;
    const transactionFees = useMemo(() => getTransactionFees({}, networkProperties, transactionSize), []);

    const [send] = useDataManager(
        async () => {
            await TransactionService.sendMosaicCreationTransaction(transaction, currentAccount, networkProperties);
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
    const fetchRentalFee = async () => {
        const rentalFees = await NetworkService.fetchRentalFees(networkProperties);

        setRentalFee(rentalFees.mosaic);
    };

    useEffect(() => {
        if (transactionFees.medium) {
            setMaxFee(transactionFees[speed]);
        }
    }, [transactionFees, speed]);

    useInit(() => {
        const nonce = generateNonce();
        const mosaicId = generateMosaicId(nonce, currentAccount.address);

        setNonce(nonce);
        setMosaicId(mosaicId);
        fetchRentalFee();
    }, isWalletReady);

    return (
        <Screen
            isLoading={!isWalletReady}
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
                    </>
                )}
                {!isMultisigAccount && (
                    <>
                        <FormItem>
                            <StyledText type="title">{$t('s_mosaicCreation_mosaic_title')}</StyledText>
                            <StyledText type="body">{$t('s_mosaicCreation_mosaic_description')}</StyledText>
                        </FormItem>
                        <FormItem>
                            <TextBox title={$t('input_supply')} value={supply} errorMessage={supplyErrorMessage} onChange={setSupply} />
                        </FormItem>
                        <FormItem>
                            <TextBox
                                title={$t('input_divisibility')}
                                value={divisibility}
                                errorMessage={divisibilityErrorMessage}
                                onChange={setDivisibility}
                            />
                        </FormItem>
                        <FormItem>
                            <Widget>
                                <FormItem>
                                    <Checkbox
                                        title={$t('s_mosaicCreation_supplyMutable_checkbox')}
                                        value={isSupplyMutable}
                                        onChange={toggleIsSupplyMutable}
                                    />
                                </FormItem>
                                <FormItem>
                                    <StyledText type="body">{$t('s_mosaicCreation_supplyMutable_description')}</StyledText>
                                </FormItem>
                            </Widget>
                        </FormItem>
                        <FormItem>
                            <Widget>
                                <FormItem>
                                    <Checkbox
                                        title={$t('s_mosaicCreation_transferable_checkbox')}
                                        value={isTransferable}
                                        onChange={toggleIsTransferable}
                                    />
                                </FormItem>
                                <FormItem>
                                    <StyledText type="body">{$t('s_mosaicCreation_transferable_description')}</StyledText>
                                </FormItem>
                            </Widget>
                        </FormItem>
                        <FormItem>
                            <Widget>
                                <FormItem>
                                    <Checkbox
                                        title={$t('s_mosaicCreation_restrictable_checkbox')}
                                        value={isRestrictable}
                                        onChange={toggleIsRestrictable}
                                    />
                                </FormItem>
                                <FormItem>
                                    <StyledText type="body">{$t('s_mosaicCreation_restrictable_description')}</StyledText>
                                </FormItem>
                            </Widget>
                        </FormItem>
                        <FormItem>
                            <Widget>
                                <FormItem>
                                    <Checkbox
                                        title={$t('s_mosaicCreation_revokable_checkbox')}
                                        value={isRevokable}
                                        onChange={toggleIsRevokable}
                                    />
                                </FormItem>
                                <FormItem>
                                    <StyledText type="body">{$t('s_mosaicCreation_revokable_description')}</StyledText>
                                </FormItem>
                            </Widget>
                        </FormItem>
                        <FormItem>
                            <StyledText type="title">{$t('s_mosaicCreation_duration_title')}</StyledText>
                            <StyledText type="body">{$t('s_mosaicCreation_duration_description')}</StyledText>
                        </FormItem>
                        <FormItem>
                            <Checkbox title={'Non-expiring'} value={!isExpiring} onChange={toggleIsExpiring} />
                        </FormItem>
                        {isExpiring && (
                            <FormItem>
                                <TextBox
                                    title={$t('input_duration')}
                                    value={duration}
                                    errorMessage={durationErrorMessage}
                                    onChange={setDuration}
                                    contentRight={
                                        <StyledText type="regular">
                                            {isExpiring
                                                ? $t('s_mosaicCreation_durationDays', {
                                                      duration: Math.round(
                                                          (networkProperties?.blockGenerationTargetTime * duration) / 86400
                                                      ),
                                                  })
                                                : '∞'}
                                        </StyledText>
                                    }
                                />
                            </FormItem>
                        )}
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
                title={$t('s_mosaicCreation_confirm_title')}
                style={layout.fill}
                contentContainerStyle={layout.fill}
                body={
                    <ScrollView>
                        <TableView data={transaction} />
                    </ScrollView>
                }
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
