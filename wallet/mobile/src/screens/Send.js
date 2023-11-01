import _ from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
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
} from 'src/components';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import { AccountService, MosaicService, TransactionService } from 'src/services';
import { connect } from 'src/store';
import {
    getAddressName,
    getMosaicsWithRelativeAmounts,
    getTransactionFees,
    handleError,
    toFixedNumber,
    useDataManager,
    usePasscode,
    useProp,
    useToggle,
} from 'src/utils';
import { TransactionType } from 'symbol-sdk';

export const Send = connect((state) => ({
    walletAccounts: state.wallet.accounts,
    addressBook: state.addressBook.addressBook,
    currentAccount: state.account.current,
    cosignatories: state.account.cosignatories,
    multisigAddresses: state.account.multisigAddresses,
    isMultisigAccount: state.account.isMultisig,
    isAccountReady: state.account.isReady,
    currentAccountMosaics: state.account.mosaics,
    mosaicInfos: state.wallet.mosaicInfos,
    networkProperties: state.network.networkProperties,
    networkIdentifier: state.network.networkIdentifier,
    ticker: state.network.ticker,
    chainHeight: state.network.chainHeight,
    price: state.market.price,
}))(function Send(props) {
    const {
        walletAccounts,
        addressBook,
        currentAccount,
        cosignatories,
        multisigAddresses,
        isMultisigAccount,
        isAccountReady,
        currentAccountMosaics,
        networkProperties,
        networkIdentifier,
        ticker,
        chainHeight,
        price,
        route,
    } = props;
    const accounts = walletAccounts[networkIdentifier];
    const [senderList, setSenderList] = useState([]);
    const [sender, setSender] = useProp(currentAccount?.address);
    const [recipient, setRecipient] = useProp(route.params?.recipientAddress || '');
    const [mosaics, setMosaics] = useProp(currentAccountMosaics);
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
    const isButtonDisabled = !isRecipientValid || !isAmountValid || !selectedMosaic;
    const isAccountCosignatoryOfMultisig = !!multisigAddresses?.length;
    const isMultisig = sender !== currentAccount?.address;
    const transaction = {
        type: TransactionType.TRANSFER,
        signerAddress: currentAccount.address,
        sender: isMultisig ? sender : null,
        recipient,
        mosaics: selectedMosaic
            ? [
                  {
                      ...selectedMosaic,
                      amount: parseFloat(amount || 0),
                  },
              ]
            : [],
        message: message
            ? {
                  text: message,
                  isEncrypted: !isMultisig ? isEncrypted : false,
              }
            : null,
        messageEncrypted: !!message && !isMultisig ? isEncrypted : null,
        fee: maxFee,
    };
    const cosignatoryList = { cosignatories };

    const transactionFees = useMemo(() => getTransactionFees(transaction, networkProperties), [message, isEncrypted]);

    const getTransactionPreviewTable = (data) => _.omit(data, ['type']);
    const getAvailableBalance = () => {
        const selectedMosaicBalance = selectedMosaic?.amount || 0;
        const selectedMosaicDivisibility = selectedMosaic?.divisibility || 0;
        const isSelectedNativeMosaic = mosaicId === networkProperties.networkCurrency.mosaicId;
        const mosaicAmountSubtractFee = isSelectedNativeMosaic ? parseFloat(maxFee) : 0;

        return Math.max(0, toFixedNumber(selectedMosaicBalance - mosaicAmountSubtractFee, selectedMosaicDivisibility));
    };
    const getMosaicPrice = () => {
        const isSelectedNativeMosaic = mosaicId === networkProperties.networkCurrency.mosaicId;

        return isSelectedNativeMosaic ? price : null;
    };
    const [fetchAccountMosaics, isMosaicsLoading] = useDataManager(
        async (sender) => {
            const { mosaics } = await AccountService.fetchAccountInfo(networkProperties, sender);
            const mosaicIds = mosaics.map((mosaic) => mosaic.id);
            const mosaicInfos = await MosaicService.fetchMosaicInfos(networkProperties, mosaicIds);
            const formattedMosaics = getMosaicsWithRelativeAmounts(mosaics, mosaicInfos);
            setMosaicId(formattedMosaics[0].id);
            setMosaics(formattedMosaics);
        },
        null,
        (e) => {
            handleError(e);
            setMosaicId(null);
            setMosaics([]);
        }
    );
    const [send, isSending] = useDataManager(
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
    };

    // Update transaction maxFee value when speed is changed or fees recalculated
    useEffect(() => {
        if (transactionFees.medium) {
            setMaxFee(transactionFees[speed]);
        }
    }, [transactionFees, speed]);

    // Update properties when account data is loaded
    useEffect(() => {
        if (!mosaicId) {
            setMosaicId(mosaics[0]?.id);
        }
        if (multisigAddresses?.length) {
            const list = [currentAccount.address, ...multisigAddresses].map((address) => ({
                value: address,
                label: getAddressName(address, currentAccount, accounts, addressBook),
            }));
            setSenderList(list);
        }
        setSender(currentAccount.address);
    }, [isAccountReady, mosaicId, currentAccount, multisigAddresses]);

    // Update mosaic list when sender address is changed
    useEffect(() => {
        if (sender === currentAccount.address) {
            setMosaics(currentAccountMosaics);
        } else {
            fetchAccountMosaics(sender);
        }
    }, [sender, currentAccount, currentAccountMosaics]);

    return (
        <Screen
            isLoading={!isAccountReady || isMosaicsLoading || isSending}
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
                        {isAccountCosignatoryOfMultisig && (
                            <FormItem>
                                <StyledText type="body">{$t('s_send_multisig_description')}</StyledText>
                            </FormItem>
                        )}
                        {isAccountCosignatoryOfMultisig && (
                            <FormItem>
                                <Dropdown title={$t('input_sender')} value={sender} list={senderList} onChange={setSender} />
                            </FormItem>
                        )}
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
                                availableBalance={getAvailableBalance()}
                                price={getMosaicPrice()}
                                networkIdentifier={networkIdentifier}
                                value={amount}
                                onChange={setAmount}
                                onValidityChange={setAmountValid}
                            />
                        </FormItem>
                        <FormItem>
                            <TextBox title={$t('form_transfer_input_message')} value={message} onChange={setMessage} />
                        </FormItem>
                        {!isMultisig && (
                            <FormItem>
                                <Checkbox title={$t('form_transfer_input_encrypted')} value={isEncrypted} onChange={toggleEncrypted} />
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
