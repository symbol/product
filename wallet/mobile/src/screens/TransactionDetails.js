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
} from '@/app/components';
import { config } from '@/app/config';
import { $t } from '@/app/localization';
import { Router } from '@/app/Router';
import { TransactionService } from '@/app/lib/services';
import { borders, colors, fonts, spacings } from '@/app/styles';
import {
    formatDate,
    handleError,
    isAddressKnown,
    isAggregateTransaction,
    isIncomingTransaction,
    isMosaicRevokable,
    isOutgoingTransaction,
} from '@/app/utils';
import { useDataManager, useInit } from '@/app/hooks';
import { MessageType, TransactionGroup, TransactionType } from '@/app/constants';
import WalletController from '@/app/lib/controller/MobileWalletController';
import { observer } from 'mobx-react-lite';

const SCREEN_HEIGHT = Dimensions.get('screen').height;
const COSIGNATURE_FORM_HEIGHT = SCREEN_HEIGHT / 4;

export const TransactionDetails = observer(function TransactionDetails(props) {
    const { isWalletReady, chainHeight, accounts, currentAccount, ticker, networkIdentifier, networkProperties } = WalletController;
    const { addressBook } = WalletController.modules;
    const { transaction } = props.route.params;
    const walletAccounts = accounts[networkIdentifier];
    const [fetchPartialInfo, isPartialInfoLoading, partialInfo] = useDataManager(() => {
        if (transaction.type === TransactionType.AGGREGATE_BONDED) {
            const transactionOptions = {
                group: TransactionGroup.PARTIAL,
                currentAccount,
                networkProperties,
            };
            return TransactionService.fetchTransactionInfo(transaction.hash, transactionOptions);
        }
    });
    const date = transaction.timestamp ? formatDate(transaction.timestamp, $t, true) : null;
    const [fetchStatus, isStatusLoading, status] = useDataManager(() => {
        return TransactionService.fetchStatus(transaction.hash || transaction.id, networkProperties);
    }, null);
    const [getMessage, isMessageLoading, decryptedMessageText] = useDataManager(
        () => {
            if (transaction.message?.type === MessageType.EncryptedText) {
                return WalletController.modules.transfer.getDecryptedMessageText(transaction);
            } else if (transaction.message?.type === MessageType.PlainText) {
                return transaction.message.text;
            }

            return null;
        },
        null,
        handleError
    );
    useInit(fetchPartialInfo, isWalletReady);
    useInit(fetchStatus, isWalletReady);
    useInit(getMessage, isWalletReady);
    const isLoading = isPartialInfoLoading || isStatusLoading || isMessageLoading;

    const isAggregate = isAggregateTransaction(transaction);
    const styleAmount = [styles.textAmount];
    const statusTextStyle = [styles.statusText];
    const statusText = status?.group ? $t(`transactionStatus_${status.group}`) : '';
    let action = $t(`transactionDescriptor_${transaction.type}`);
    const revokableMosaics = [];
    let statusIconSrc;
    let isAddSignerContactButtonShown = false;
    let isAddRecipientContactButtonShown = false;
    let isRevokeButtonVisible = false;

    switch (status?.group) {
        case TransactionGroup.UNCONFIRMED:
            statusTextStyle.push(styles.statusTextUnconfirmed);
            statusIconSrc = require('@/app/assets/images/icon-status-unconfirmed.png');
            break;
        case TransactionGroup.PARTIAL:
            statusTextStyle.push(styles.statusTextPartial);
            statusIconSrc = require('@/app/assets/images/icon-status-partial-1.png');
            break;
        case TransactionGroup.CONFIRMED:
            statusTextStyle.push(styles.statusTextConfirmed);
            statusIconSrc = require('@/app/assets/images/icon-status-confirmed.png');
            break;
        case TransactionGroup.FAILED:
            statusTextStyle.push(styles.statusTextFailed);
            statusIconSrc = require('@/app/assets/images/icon-status-failed.png');
            break;
    }

    if (transaction.type === TransactionType.TRANSFER && isOutgoingTransaction(transaction, currentAccount)) {
        action = $t(`transactionDescriptor_${transaction.type}_outgoing`);
        isAddRecipientContactButtonShown = !isAddressKnown(transaction.recipientAddress, walletAccounts, addressBook);
        transaction.mosaics.forEach((mosaic) => {
            if (isMosaicRevokable(mosaic, chainHeight, currentAccount.address)) {
                revokableMosaics.push(mosaic);
            }
        });
        isRevokeButtonVisible = status?.group === TransactionGroup.CONFIRMED && !!revokableMosaics.length;
    } else if (transaction.type === TransactionType.TRANSFER && isIncomingTransaction(transaction, currentAccount)) {
        action = $t(`transactionDescriptor_${transaction.type}_incoming`);
        isAddSignerContactButtonShown = !isAddressKnown(transaction.signerAddress, walletAccounts, addressBook);
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
    const handleRevokePress = () => Router.goToRevoke({ mosaics: revokableMosaics, sourceAddress: transaction.recipientAddress });

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
                            icon={require('@/app/assets/images/icon-primary-address-book.png')}
                            title={$t('button_addSignerToAddressBook')}
                            onPress={addSignerContact}
                        />
                    </FormItem>
                )}
                {isAddRecipientContactButtonShown && (
                    <FormItem>
                        <ButtonPlain
                            icon={require('@/app/assets/images/icon-primary-address-book.png')}
                            title={$t('button_addRecipientToAddressBook')}
                            onPress={addRecipientContact}
                        />
                    </FormItem>
                )}
                {isRevokeButtonVisible && (
                    <FormItem>
                        <ButtonPlain
                            icon={require('@/app/assets/images/icon-primary-revoke.png')}
                            title={$t('button_revoke')}
                            onPress={handleRevokePress}
                        />
                    </FormItem>
                )}
                <FormItem>
                    <ButtonPlain
                        icon={require('@/app/assets/images/icon-primary-explorer.png')}
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
