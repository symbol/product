import React, { useEffect, useState } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import {
    Alert,
    Button,
    Checkbox,
    DialogBox,
    Dropdown,
    FeeSelector,
    FormItem,
    InputAddress,
    InputAmount,
    Screen,
    SelectMosaic,
    StyledText,
    TableView,
    TextBox,
} from '@/app/components';
import { $t } from '@/app/localization';
import { Router } from '@/app/Router';
import { AccountService } from '@/app/lib/services';
import {
    createMultisigTransferTransactionStub,
    createSingleTransferTransactionStub,
    getAddressName,
    handleError,
    toFixedNumber,
} from '@/app/utils';
import { useDataManager, usePasscode, useProp, useToggle } from '@/app/hooks';
import { useTransactionFees } from '@/app/hooks';
import { MessageType, TransactionType } from '@/app/constants';
import WalletController from '@/app/lib/controller/MobileWalletController';
import { observer } from 'mobx-react-lite';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

export const Send = observer(function Send(props) {
    const {
        accounts,
        addressBook,
        currentAccount,
        currentAccountInfo,
        isStateReady,
        isWalletReady,
        isNetworkConnectionReady,
        networkProperties,
        networkIdentifier,
        ticker,
        chainHeight,
        price,
    } = WalletController;
    const { route } = props;
    const walletAccounts = accounts[networkIdentifier];

    // UI
    const [isConfirmVisible, toggleConfirm] = useToggle(false);
    const [isSuccessAlertVisible, toggleSuccessAlert] = useToggle(false);
    const [senderOptions, setSenderOptions] = useState([]);
    const [senderMosaicList, setSenderMosaicList] = useState([]);
    const senderMosaicOptions = senderMosaicList.map((mosaic) => ({
        label: mosaic.name,
        value: mosaic.id,
        mosaicInfo: mosaic,
    }));
    const [isAmountValid, setAmountValid] = useState(false);
    const [isRecipientValid, setRecipientValid] = useState(false);

    // Inputs
    const [senderAddress, setSenderAddress] = useProp(currentAccount.address);
    const [recipientAddressOrAlias, setRecipientAddressOrAlias] = useProp(route.params?.recipientAddress, '');
    const [selectedMosaicId, setSelectedMosaicId] = useProp(route.params?.mosaicId, null);
    const [amount, setAmount] = useProp(route.params?.amount, '0');
    const [messageText, setMessageText] = useProp(route.params?.message?.text, '');
    const [isMessageEncryptedCheckboxValue, toggleMessageEncrypted] = useToggle(false);
    const [speed, setSpeed] = useState('medium');

    // Other properties
    const isAccountCosignatoryOfMultisig = currentAccountInfo.multisigAddresses.length > 0;
    const cosignatoryListTable = { cosignatories: currentAccountInfo.cosignatories };
    const isMultisigTransfer = senderAddress !== currentAccount.address;

    // Fields
    const [senderPublicKey, setSenderPublicKey] = useProp(currentAccount.publicKey);
    const selectedMosaic = senderMosaicList.find((mosaic) => mosaic.id === selectedMosaicId) || senderMosaicList[0];
    const mosaics = selectedMosaic ? [{ ...selectedMosaic, amount: Number(amount) }] : [];
    const [maxFee, setMaxFee] = useState(0);
    const [transaction, setTransaction] = useState(null);
    const isMessageEncrypted = isMultisigTransfer ? false : isMessageEncryptedCheckboxValue;

    // Methods
    const getTransactionPreviewTable = (data) => {
        if (!data) return null;

        const transfer = data.type === TransactionType.TRANSFER ? data : data.innerTransactions[0];

        return {
            type: data.type,
            sender: senderAddress,
            recipientAddress: transfer.recipientAddress,
            mosaics: transfer.mosaics,
            message: transfer.message,
            messageEncrypted: transfer.message?.type ? transfer.message.type === MessageType.EncryptedText : null,
            fee: data.fee,
        };
    };
    const getAvailableBalance = () => {
        const selectedMosaicBalance = selectedMosaic?.amount || 0;
        const selectedMosaicDivisibility = selectedMosaic?.divisibility || 0;
        const isSelectedNativeMosaic = selectedMosaic?.id === networkProperties.networkCurrency.mosaicId;
        const mosaicAmountSubtractFee = isSelectedNativeMosaic ? parseFloat(maxFee) : 0;

        return Math.max(0, toFixedNumber(selectedMosaicBalance - mosaicAmountSubtractFee, selectedMosaicDivisibility));
    };
    const getMosaicPrice = () => {
        const isSelectedNativeMosaic = selectedMosaicId === networkProperties.networkCurrency.mosaicId;

        return isSelectedNativeMosaic ? price : null;
    };
    const [send, isSending] = useDataManager(
        async () => {
            await WalletController.signAndAnnounceTransaction(transaction, true);
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
    const [handleSendButtonPress, isTransactionPreparing] = useDataManager(
        async () => {
            const transaction = await WalletController.modules.transfer.createTransaction({
                senderPublicKey,
                recipientAddressOrAlias,
                mosaics,
                messageText,
                isMessageEncrypted,
            });
            transaction.fee = maxFee;

            setTransaction(transaction);
            toggleConfirm();
        },
        null,
        handleError
    );

    // Update transaction maxFee value when speed is changed or fees recalculated
    const transactionStub = isMultisigTransfer
        ? createMultisigTransferTransactionStub({ messageText, isMessageEncrypted, mosaics })
        : createSingleTransferTransactionStub({ messageText, isMessageEncrypted, mosaics });
    const transactionFees = useTransactionFees(transactionStub, networkProperties);
    useEffect(() => {
        if (transactionFees.medium) {
            setMaxFee(transactionFees[speed]);
        }
    }, [transactionFees, speed]);

    // Handle the sender address list after the wallet is ready
    useEffect(() => {
        if (currentAccountInfo.multisigAddresses.length) {
            const senderAddresses = [currentAccount.address, ...currentAccountInfo.multisigAddresses];
            const senderAddressOptions = senderAddresses.map((address) => ({
                value: address,
                label: getAddressName(address, currentAccount, walletAccounts, addressBook),
            }));
            setSenderOptions(senderAddressOptions);
        }
    }, [isStateReady, currentAccount, currentAccountInfo.multisigAddresses]);

    // Update the mosaic list and sender public key after sender's address changed
    const updateSenderInfo = (mosaics, publicKey) => {
        setSenderMosaicList(mosaics);
        setSelectedMosaicId(mosaics[0]?.id || null);
        setSenderPublicKey(publicKey);
    };
    const [fetchSenderInfo, isSenderInfoLoading] = useDataManager(
        async (sender) => {
            const { mosaics, publicKey } = await AccountService.fetchAccountInfo(networkProperties, sender);
            updateSenderInfo(mosaics, publicKey);
        },
        null,
        (e) => {
            handleError(e);
            updateSenderInfo([], '');
        }
    );
    useEffect(() => {
        setSelectedMosaicId(null);
        if (currentAccount.address === senderAddress) {
            updateSenderInfo(currentAccountInfo.mosaics, currentAccount.publicKey);
        } else {
            fetchSenderInfo(senderAddress);
        }
    }, [currentAccount, currentAccountInfo.mosaics, senderAddress]);

    const isLoading = !isWalletReady || isSenderInfoLoading || isSending || isTransactionPreparing;
    const isButtonDisabled = !isNetworkConnectionReady || !isRecipientValid || !isAmountValid || !mosaics.length;

    return (
        <Screen
            isLoading={isLoading}
            bottomComponent={
                <FormItem>
                    <Button title={$t('button_send')} isDisabled={isButtonDisabled} onPress={handleSendButtonPress} />
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
                            <TableView data={cosignatoryListTable} />
                        </FormItem>
                    </>
                )}
                {!currentAccountInfo.isMultisig && (
                    <>
                        <FormItem>
                            <StyledText type="title">{$t('form_transfer_title')}</StyledText>
                            <StyledText type="body">{$t('s_send_description')}</StyledText>
                        </FormItem>
                        {isAccountCosignatoryOfMultisig && (
                            <FormItem>
                                <StyledText type="body">{$t('s_send_multisig_description')}</StyledText>
                            </FormItem>
                        )}
                        {isAccountCosignatoryOfMultisig && (
                            <FormItem>
                                <Dropdown
                                    title={$t('input_sender')}
                                    value={senderAddress}
                                    list={senderOptions}
                                    onChange={setSenderAddress}
                                />
                            </FormItem>
                        )}
                        <FormItem>
                            <InputAddress
                                title={$t('form_transfer_input_recipient')}
                                value={recipientAddressOrAlias}
                                onChange={setRecipientAddressOrAlias}
                                onValidityChange={setRecipientValid}
                            />
                        </FormItem>
                        <FormItem>
                            <SelectMosaic
                                title={$t('form_transfer_input_mosaic')}
                                value={selectedMosaicId}
                                list={senderMosaicOptions}
                                chainHeight={chainHeight}
                                onChange={setSelectedMosaicId}
                            />
                        </FormItem>
                        <FormItem>
                            <InputAmount
                                title={$t('form_transfer_input_amount')}
                                availableBalance={getAvailableBalance()}
                                price={getMosaicPrice()}
                                networkIdentifier={networkIdentifier}
                                value={amount}
                                onChange={setAmount}
                                onValidityChange={setAmountValid}
                            />
                        </FormItem>
                        <FormItem>
                            <TextBox title={$t('form_transfer_input_message')} value={messageText} onChange={setMessageText} />
                        </FormItem>
                        {!isMultisigTransfer && (
                            <FormItem>
                                <Checkbox
                                    title={$t('form_transfer_input_encrypted')}
                                    value={isMessageEncrypted}
                                    onChange={toggleMessageEncrypted}
                                />
                            </FormItem>
                        )}
                        <Animated.View entering={FadeInDown} exiting={FadeOut}>
                            <FormItem>
                                <FeeSelector
                                    title={$t('form_transfer_input_fee')}
                                    value={speed}
                                    fees={transactionFees}
                                    ticker={ticker}
                                    onChange={setSpeed}
                                />
                            </FormItem>
                        </Animated.View>
                    </>
                )}
            </ScrollView>
            <DialogBox
                type="confirm"
                title={$t('form_transfer_confirm_title')}
                body={
                    <ScrollView>
                        <TableView data={getTransactionPreviewTable(transaction)} />
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
