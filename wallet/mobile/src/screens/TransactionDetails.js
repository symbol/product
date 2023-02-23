import _ from 'lodash';
import React from 'react';
import { useMemo } from 'react';
import { Dimensions, Image, Linking, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
    ButtonPlain,
    FormItem,
    LoadingIndicator,
    Screen,
    StyledText,
    TableView,
    TransactionCosignatureForm,
    TransactionGraphic,
} from 'src/components';
import { config } from 'src/config';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import { TransactionService } from 'src/services';
import { connect } from 'src/store';
import { borders, colors, fonts, spacings } from 'src/styles';
import {
    formatDate,
    handleError,
    isAddressKnown,
    isAggregateTransaction,
    isIncomingTransaction,
    isOutgoingTransaction,
    useDataManager,
    useInit,
} from 'src/utils';
import { TransactionType } from 'symbol-sdk';

const SCREEN_HEIGHT = Dimensions.get('screen').height;
const COSIGNATURE_FORM_HEIGHT = SCREEN_HEIGHT / 4;

export const TransactionDetails = connect((state) => ({
    isWalletReady: state.wallet.isReady,
    addressBook: state.addressBook.addressBook,
    walletAccounts: state.wallet.accounts,
    currentAccount: state.account.current,
    ticker: state.network.ticker,
    networkIdentifier: state.network.networkIdentifier,
    networkProperties: state.network.networkProperties,
}))(function TransactionDetails(props) {
    const { isWalletReady, addressBook, walletAccounts, currentAccount, ticker, networkIdentifier, networkProperties } = props;
    const { transaction } = props.route.params;
    const accounts = walletAccounts[networkIdentifier];
    const [fetchPartialInfo, isPartialInfoLoading, partialInfo] = useDataManager(() => {
        if (transaction.type === TransactionType.AGGREGATE_BONDED) {
            return TransactionService.fetchPartialInfo(transaction.hash, currentAccount, networkProperties);
        }
    });
    const [fetchDate, isDateLoading, date] = useDataManager(async () => {
        const timestamp = await TransactionService.fetchDate(transaction.height, networkProperties);
        return formatDate(timestamp, $t, true);
    }, null);
    const [fetchStatus, isStatusLoading, status] = useDataManager(() => {
        return TransactionService.fetchStatus(transaction.hash || transaction.id, networkProperties);
    }, null);
    const [decryptMessage, isMessageLoading, decryptedMessageText] = useDataManager(
        () => {
            if (!transaction.message) {
                return null;
            }
            return TransactionService.decryptMessage(transaction, currentAccount, networkProperties);
        },
        null,
        handleError
    );
    useInit(fetchDate, isWalletReady);
    useInit(fetchPartialInfo, isWalletReady);
    useInit(fetchStatus, isWalletReady);
    useInit(decryptMessage, isWalletReady);
    const isLoading = isPartialInfoLoading || isDateLoading || isStatusLoading || isMessageLoading;

    const isAggregate = isAggregateTransaction(transaction);
    const styleAmount = [styles.textAmount];
    const statusTextStyle = [styles.statusText];
    const statusText = status?.group ? $t(`transactionStatus_${status.group}`) : '';
    let action = $t(`transactionDescriptor_${transaction.type}`);
    let statusIconSrc;
    let isAddSignerContactButtonShown = false;
    let isAddRecipientContactButtonShown = false;

    switch (status?.group) {
        case 'unconfirmed':
            statusTextStyle.push(styles.statusTextUnconfirmed);
            statusIconSrc = require('src/assets/images/icon-status-unconfirmed.png');
            break;
        case 'partial':
            statusTextStyle.push(styles.statusTextPartial);
            statusIconSrc = require('src/assets/images/icon-status-partial-1.png');
            break;
        case 'confirmed':
            statusTextStyle.push(styles.statusTextConfirmed);
            statusIconSrc = require('src/assets/images/icon-status-confirmed.png');
            break;
        case 'failed':
            statusTextStyle.push(styles.statusTextFailed);
            statusIconSrc = require('src/assets/images/icon-status-failed.png');
            break;
    }

    if (transaction.type === TransactionType.TRANSFER && isOutgoingTransaction(transaction, currentAccount)) {
        action = $t(`transactionDescriptor_${transaction.type}_outgoing`);
        isAddRecipientContactButtonShown = !isAddressKnown(transaction.recipientAddress, accounts, addressBook);
    } else if (transaction.type === TransactionType.TRANSFER && isIncomingTransaction(transaction, currentAccount)) {
        action = $t(`transactionDescriptor_${transaction.type}_incoming`);
        isAddSignerContactButtonShown = !isAddressKnown(transaction.signerAddress, accounts, addressBook);
    }

    if (transaction.amount < 0) {
        styleAmount.push(styles.outgoing);
    } else if (transaction.amount > 0) {
        styleAmount.push(styles.incoming);
    }

    const updatedTransactionData = useMemo(() => {
        if (!decryptedMessageText) {
            return transaction;
        }
        const transactionCopy = { ...transaction };
        transactionCopy.message.text = decryptedMessageText;

        return transactionCopy;
    }, [transaction, decryptedMessageText]);
    const details = _.pick(transaction, ['height', 'hash', 'fee', 'signerAddress', 'receivedCosignatures']);

    const addSignerContact = () => {
        Router.goBack();
        Router.goToAddressBookEdit({ address: transaction.signerAddress });
    };
    const addRecipientContact = () => {
        Router.goBack();
        Router.goToAddressBookEdit({ address: transaction.recipientAddress });
    };
    const openBlockExplorer = () => Linking.openURL(config.explorerURL[networkIdentifier] + '/transactions/' + transaction.hash);

    return (
        <Screen bottomComponent2={partialInfo && <TransactionCosignatureForm height={COSIGNATURE_FORM_HEIGHT} transaction={partialInfo} />}>
            <ScrollView>
                <FormItem>
                    <StyledText type="title-large" style={styles.textAction}>
                        {action}
                    </StyledText>
                    <View>
                        <FormItem clear="horizontal" style={styles.formItem}>
                            <StyledText type="label">{$t('s_transactionDetails_amount')}</StyledText>
                            <StyledText style={styleAmount}>
                                {transaction.amount || 0} {ticker}
                            </StyledText>
                        </FormItem>
                    </View>
                    <View style={styles.statusDateRow}>
                        <FormItem clear="horizontal" style={styles.formItem}>
                            <StyledText type="label">{$t('s_transactionDetails_status')}</StyledText>
                            <View style={styles.statusBadge}>
                                <Image source={statusIconSrc} style={styles.statusIcon} />
                                <Text style={statusTextStyle}>{statusText}</Text>
                            </View>
                        </FormItem>
                        {!!date && !isLoading && (
                            <FormItem clear="horizontal" style={styles.date}>
                                <Animated.View entering={FadeIn}>
                                    <StyledText type="label">{$t('s_transactionDetails_date')}</StyledText>
                                    <StyledText type="body">{date}</StyledText>
                                </Animated.View>
                            </FormItem>
                        )}
                        {isLoading && <LoadingIndicator size="sm" />}
                    </View>
                </FormItem>
                {!isAggregate && (
                    <FormItem>
                        <TransactionGraphic transaction={updatedTransactionData} isExpanded />
                    </FormItem>
                )}
                {isAggregate && (
                    <FormItem>
                        {isAggregate &&
                            transaction.innerTransactions.map((item, index) => (
                                <FormItem type="list" key={'inner' + index}>
                                    <TransactionGraphic transaction={item} />
                                </FormItem>
                            ))}
                    </FormItem>
                )}
                <FormItem>
                    <TableView data={details} currentAccount={currentAccount} />
                </FormItem>
                {isAddSignerContactButtonShown && (
                    <FormItem>
                        <ButtonPlain
                            icon={require('src/assets/images/icon-primary-address-book.png')}
                            title={$t('button_addSignerToAddressBook')}
                            onPress={addSignerContact}
                        />
                    </FormItem>
                )}
                {isAddRecipientContactButtonShown && (
                    <FormItem>
                        <ButtonPlain
                            icon={require('src/assets/images/icon-primary-address-book.png')}
                            title={$t('button_addRecipientToAddressBook')}
                            onPress={addRecipientContact}
                        />
                    </FormItem>
                )}
                <FormItem>
                    <ButtonPlain
                        icon={require('src/assets/images/icon-primary-explorer.png')}
                        title={$t('button_openTransactionInExplorer')}
                        onPress={openBlockExplorer}
                    />
                </FormItem>
            </ScrollView>
        </Screen>
    );
});

const styles = StyleSheet.create({
    textAction: {
        maxWidth: '75%',
    },
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
    innerTransactionContainer: {
        backgroundColor: colors.bgForm,
        borderRadius: borders.borderRadius,
        padding: spacings.padding,
    },
    statusDateRow: {
        flexDirection: 'row',
        position: 'relative',
    },
    date: {
        marginLeft: spacings.margin,
        height: 30,
        width: '50%',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusText: {
        ...fonts.body,
        color: colors.textBody,
    },
    statusTextUnconfirmed: {
        color: colors.warning,
    },
    statusTextPartial: {
        color: colors.info,
    },
    statusTextConfirmed: {
        color: colors.success,
    },
    statusTextFailed: {
        color: colors.danger,
    },
    statusIcon: {
        width: 18,
        height: 18,
        marginRight: spacings.margin / 2,
    },
    formItem: {
        flexDirection: 'column',
        flex: 1,
    },
});
