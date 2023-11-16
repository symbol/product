import _ from 'lodash';
import React from 'react';
import { useMemo } from 'react';
import { useEffect } from 'react';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import {
    Alert,
    Button,
    ButtonPlain,
    DialogBox,
    FeeSelector,
    FormItem,
    Screen,
    StyledText,
    TableView,
    TitleBar,
    TransactionGraphic,
    Widget,
} from 'src/components';
import { TransactionType } from 'src/config';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import { MosaicService, NamespaceService, TransactionService } from 'src/services';
import store, { connect } from 'src/store';
import { colors, fonts, layout } from 'src/styles';
import {
    getTransactionFees,
    getUnresolvedIdsFromTransactionDTOs,
    handleError,
    isAggregateTransaction,
    publicAccountFromPrivateKey,
    transactionFromDTO,
    transactionFromPayload,
    useDataManager,
    useInit,
    usePasscode,
    useToggle,
} from 'src/utils';

const SUPPORTED_TRANSACTION_TYPES = [
    TransactionType.AGGREGATE_BONDED,
    TransactionType.AGGREGATE_COMPLETE,
    TransactionType.TRANSFER,
    TransactionType.ADDRESS_ALIAS,
    TransactionType.MOSAIC_ALIAS,
    TransactionType.NAMESPACE_REGISTRATION,
    TransactionType.MOSAIC_DEFINITION,
    TransactionType.MOSAIC_SUPPLY_CHANGE,
    TransactionType.MOSAIC_SUPPLY_REVOCATION,
    TransactionType.VRF_KEY_LINK,
    TransactionType.ACCOUNT_KEY_LINK,
    TransactionType.NODE_KEY_LINK,
    TransactionType.VOTING_KEY_LINK,
    TransactionType.ACCOUNT_METADATA,
    TransactionType.NAMESPACE_METADATA,
    TransactionType.MOSAIC_METADATA,
];

export const TransactionRequest = connect((state) => ({
    currentAccount: state.account.current,
    cosignatories: state.account.cosignatories,
    isMultisigAccount: state.account.isMultisig,
    isAccountReady: state.account.isReady,
    isWalletReady: state.wallet.isReady,
    networkProperties: state.network.networkProperties,
    ticker: state.network.ticker,
}))(function TransactionRequest(props) {
    const { currentAccount, cosignatories, isMultisigAccount, isAccountReady, isWalletReady, networkProperties, ticker, route } = props;
    const { params } = route;
    const [transaction, setTransaction] = useState(null);
    const [payload, setPayload] = useState('');
    const [styleAmount, setStyleAmount] = useState(null);
    const [speed, setSpeed] = useState('medium');
    const [isTypeSupported, setIsTypeSupported] = useState(false);
    const [isNetworkSupported, setIsNetworkSupported] = useState(false);
    const [isConfirmVisible, toggleConfirm] = useToggle(false);
    const [isSuccessAlertVisible, toggleSuccessAlert] = useToggle(false);
    const [isErrorAlertVisible, toggleErrorAlert] = useToggle(false);
    const isTransactionLoaded = !!transaction;
    const cosignatoryList = { cosignatories };
    const isAggregate = !!transaction?.innerTransactions;

    const transactionFees = useMemo(
        () => (payload ? getTransactionFees(transaction, networkProperties, payload.length || 0) : {}),
        [payload]
    );

    const getTransactionPreviewTable = (data, isEmbedded) =>
        _.omit(data, [
            'amount',
            'innerTransactions',
            'signTransactionObject',
            'signerPublicKey',
            'deadline',
            'cosignaturePublicKeys',
            isEmbedded ? 'fee' : null,
        ]);
    const [loadTransaction, isTransactionLoading] = useDataManager(
        async (payload, generationHash) => {
            const transactionDTO = transactionFromPayload(payload);
            const { addresses, mosaicIds, namespaceIds } = getUnresolvedIdsFromTransactionDTOs([transactionDTO]);
            const mosaicInfos = await MosaicService.fetchMosaicInfos(networkProperties, mosaicIds);
            const namespaceNames = await NamespaceService.fetchNamespaceNames(networkProperties, namespaceIds);
            const resolvedAddresses = await NamespaceService.resolveAddresses(networkProperties, addresses);
            const transactionOptions = {
                networkProperties,
                currentAccount,
                mosaicInfos,
                namespaceNames,
                resolvedAddresses,
                fillSignerPublickey: publicAccountFromPrivateKey(currentAccount.privateKey, networkProperties.networkIdentifier).publicKey,
            };
            const transaction = transactionFromDTO(transactionDTO, transactionOptions, currentAccount.address);

            const styleAmount = [styles.textAmount];
            if (transaction.amount < 0) {
                styleAmount.push(styles.outgoing);
            } else if (transaction.amount > 0) {
                styleAmount.push(styles.incoming);
            }

            let isTypeSupported = false;

            if (isAggregateTransaction(transaction)) {
                isTypeSupported = transaction.innerTransactions.every((transaction) =>
                    SUPPORTED_TRANSACTION_TYPES.some((item) => item === transaction.type)
                );
            } else {
                isTypeSupported = SUPPORTED_TRANSACTION_TYPES.some((item) => item === transaction.type);
            }

            setPayload(payload);
            setTransaction(transaction);
            setIsTypeSupported(isTypeSupported);
            setIsNetworkSupported(generationHash === networkProperties.generationHash);
            setStyleAmount(styleAmount);
        },
        null,
        (e) => {
            handleError(e);
            toggleErrorAlert();
        }
    );
    const [send, isSending] = useDataManager(
        async () => {
            await TransactionService.signAndAnnounce(transaction, currentAccount, networkProperties);
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
    const cancel = () => {
        Router.goToHome();
    };

    // Update transaction maxFee value when speed is changed or fees recalculated
    useEffect(() => {
        if (transaction) {
            transaction.fee = transactionFees[speed];
        }
    }, [transactionFees, speed, transaction]);

    useEffect(() => {
        if (isAccountReady) loadTransaction(params.data, params.generationHash);
    }, [params, currentAccount, isAccountReady]);

    const [loadState, isStateLoading] = useDataManager(
        async () => {
            await store.dispatchAction({ type: 'wallet/fetchAll' });
        },
        null,
        handleError
    );
    useInit(loadState, isWalletReady, [currentAccount]);

    const isButtonDisabled = !isTransactionLoaded || !isTypeSupported || !isNetworkSupported || isMultisigAccount;
    const isLoading = !isAccountReady || isTransactionLoading || isSending || isStateLoading;

    return (
        <Screen titleBar={<TitleBar accountSelector settings currentAccount={currentAccount} />} isLoading={isLoading}>
            <ScrollView>
                <FormItem>
                    <StyledText type="title">{$t('s_transactionRequest_title')}</StyledText>
                    <StyledText type="body">{$t('s_transactionRequest_description')}</StyledText>
                </FormItem>
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
                {!isNetworkSupported && (
                    <FormItem>
                        <Alert
                            type="warning"
                            title={$t('warning_transactionRequest_networkType_title')}
                            body={$t('warning_transactionRequest_networkType_body')}
                        />
                    </FormItem>
                )}
                {!isTypeSupported && (
                    <>
                        <FormItem>
                            <Alert
                                type="warning"
                                title={$t('warning_transactionRequest_transactionType_title')}
                                body={$t('warning_transactionRequest_transactionType_body')}
                            />
                        </FormItem>
                        <FormItem>
                            <Widget>
                                <FormItem>
                                    <StyledText type="subtitle">{$t('s_transactionRequest_supportedTypes_title')}</StyledText>
                                    {SUPPORTED_TRANSACTION_TYPES.map((type, index) => (
                                        <StyledText type="body" key={index}>
                                            {$t(`transactionDescriptor_${type}`)}
                                        </StyledText>
                                    ))}
                                </FormItem>
                            </Widget>
                        </FormItem>
                    </>
                )}
                <FormItem>
                    <StyledText type="label">{$t('s_transactionDetails_amount')}</StyledText>
                    <StyledText style={styleAmount}>
                        {transaction ? transaction.amount : '-'} {ticker}
                    </StyledText>
                </FormItem>
                <FormItem>
                    {isTransactionLoaded && !isAggregate && <TransactionGraphic transaction={transaction} isExpanded={isTypeSupported} />}
                    {isTransactionLoaded &&
                        isAggregate &&
                        transaction.innerTransactions.map((item, index) => (
                            <FormItem type="list" key={'tx' + index}>
                                <TransactionGraphic transaction={item} isExpanded={isTypeSupported} />
                            </FormItem>
                        ))}
                </FormItem>
                <FormItem>
                    <FeeSelector title={$t('input_feeSpeed')} value={speed} fees={transactionFees} ticker={ticker} onChange={setSpeed} />
                </FormItem>
                <FormItem>
                    <Button title={$t('button_send')} isDisabled={isButtonDisabled} onPress={toggleConfirm} />
                </FormItem>
                <FormItem>
                    <ButtonPlain title={$t('button_cancel')} style={layout.alignSelfCenter} onPress={cancel} />
                </FormItem>
            </ScrollView>
            <DialogBox
                type="confirm"
                title={$t('transaction_confirm_title')}
                body={
                    <ScrollView>
                        <FormItem clear="horizontal">
                            <TableView data={getTransactionPreviewTable(transaction)} />
                        </FormItem>
                        {transaction?.innerTransactions?.map((innerTransaction, index) => (
                            <FormItem key={'inner' + index} clear="horizontal">
                                <TableView data={getTransactionPreviewTable(innerTransaction, true)} />
                            </FormItem>
                        ))}
                    </ScrollView>
                }
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
            <DialogBox
                type="alert"
                title={$t('s_transactionRequest_error_title')}
                text={$t('s_transactionRequest_error_text')}
                isVisible={isErrorAlertVisible}
                onSuccess={Router.goToHome}
            />
        </Screen>
    );
});

const styles = StyleSheet.create({
    textAmount: {
        ...fonts.amount,
        color: colors.textBody,
    },
    outgoing: {
        color: colors.danger,
    },
    incoming: {
        color: colors.success,
    },
});
