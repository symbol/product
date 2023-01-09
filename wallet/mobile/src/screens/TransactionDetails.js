import _ from 'lodash';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AccountAvatar, Screen, StyledText, FormItem, TableView, LoadingIndicator, TouchableNative } from 'src/components';
import { $t } from 'src/localization';
import { TransactionService } from 'src/services';
import { connect } from 'src/store';
import { borders, colors, fonts, layout, spacings } from 'src/styles';
import { formatDate, getAddressName, getColorFromHash, getNativeMosaicAmount, handleError, isAggregateTransaction, isIncomingTransaction, isOutgoingTransaction, useDataManager, useInit, useToggle } from 'src/utils';
import { TransactionType } from 'symbol-sdk';

export const TransactionGraphic = connect(state => ({
    walletAccounts: state.wallet.accounts,
    currentAccount: state.account.current,
    networkIdentifier: state.network.networkIdentifier,
    networkProperties: state.network.networkProperties,
    ticker: state.network.ticker,
}))(function TransactionGraphic(props) {
    const { transaction, isExpandable, ticker, addressBook, currentAccount, networkIdentifier, networkProperties, walletAccounts } = props;
    const [isExpanded, toggle] = useToggle(false);
    const [hasBeenExpanded, setHasBeenExpanded] = useState(false);
    const networkWalletAccounts = walletAccounts[networkIdentifier];
    const signerName = getAddressName(transaction.signerAddress, currentAccount, networkWalletAccounts);

    const signerNameColorStyle = {
        color: getColorFromHash(transaction.signerAddress)
    }
    const signerNameStyle = [styles2.signerName, signerNameColorStyle];
    const targetNameStyle = [styles2.targetName];

    let Target = () => <View />;
    let targetName = '';
    const actionText = $t(`transactionDescriptor_${transaction.type}`);
    let ActionBody = () => <View style={{height: 1, width: 1}}/>

    switch(transaction.type) {
        case TransactionType.TRANSFER:
            Target = () => <AccountAvatar address={transaction.recipientAddress} size="md" />
            targetName = getAddressName(transaction.recipientAddress, currentAccount, networkWalletAccounts);
            targetNameStyle.push({
                color: getColorFromHash(transaction.recipientAddress)
            });
            const transferredAmount = getNativeMosaicAmount(transaction.mosaics, networkProperties.networkCurrency.mosaicId)
            ActionBody = () => <Text style={styles2.action}>{Math.abs(transferredAmount)} {ticker}</Text>
            break;
        case TransactionType.NAMESPACE_REGISTRATION:
            Target = () => <Image source={require('src/assets/images/icon-tx-namespace.png')} />
            targetName = transaction.namespaceName
            ActionBody = () => <Text style={styles2.action}> </Text>
            break;
        case TransactionType.MOSAIC_ALIAS:
            Target = () => <Image source={require('src/assets/images/icon-tx-mosaic.png')} />
            targetName = transaction.mosaicId
            ActionBody = () => <Text style={styles2.action}>{transaction.namespaceName}</Text>
            break;
        case TransactionType.ADDRESS_ALIAS:
            Target = () => <AccountAvatar address={transaction.address} size="md" />
            targetName = transaction.address
            ActionBody = () => <Text style={styles2.action}>{transaction.namespaceName}</Text>
            break;
    }

    const tableMaxHeight = useSharedValue(0);
    const animatedTable = useAnimatedStyle(() => ({
        maxHeight: tableMaxHeight.value
    }));


    const getTableData = () => _.omit(transaction, 'amount', 'id', 'innerTransactions', 'cosignaturePublicKeys', 'deadline', 'type', 'fee', 'status', 'height', 'hash', 'signerAddress', 'recipientAddress');
    const handlePress = () => {
        if (!hasBeenExpanded) {
            setHasBeenExpanded(true);
        }
        toggle();
        tableMaxHeight.value = withTiming(isExpanded ? 0 : 500);
    }

    return (
        <TouchableNative style={styles2.root} onPress={handlePress}>
            
                <Text style={signerNameStyle}>{signerName}</Text>
                <View style={styles2.middleSection}>
                    <AccountAvatar size="md" address={transaction.signerAddress} />
                    <View style={styles2.arrowSection}>
                        <Text style={styles2.action}>{actionText}</Text>
                        <Image source={require('src/assets/images/graphic/arrow.png')} style={styles2.arrow} />
                        <ActionBody />
                    </View>
                    <View style={styles2.target}>
                        <Target />
                    </View>
                </View>
                <Text style={targetNameStyle}>{targetName}</Text>
                <Animated.View style={animatedTable}>
                    {hasBeenExpanded && <TableView data={getTableData()} />}
                </Animated.View>

        </TouchableNative>
    );
});

const styles2 = StyleSheet.create({
    root: {
        width: '100%',
        backgroundColor: colors.bgCard,
        borderRadius: borders.borderRadius,
        padding: spacings.padding
    },
    signerName: {
        ...fonts.transactionSignerName,
        color: colors.primary,
        width: '50%',
        marginBottom: spacings.margin / 2
    },
    middleSection: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacings.margin / 2
    },
    arrowSection: {
        position: 'relative',
        marginHorizontal: spacings.margin,
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
    },
    action: {
        ...fonts.transactionSignerName,
        color: colors.controlBaseTextAlt
    },
    arrow: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        resizeMode: 'contain',       
    },
    target: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    targetName: {
        ...fonts.transactionSignerName,
        color: colors.primary,
        width: '50%',
        textAlign: 'right',
        alignSelf: 'flex-end'
    },
    table: {
        height: '100%'
    }
});



export const TransactionDetails = connect(state => ({
    isWalletReady: state.wallet.isReady,
    currentAccount: state.account.current,
    ticker: state.network.ticker,
    networkProperties: state.network.networkProperties,
}))(function TransactionDetails(props) {
    const { isWalletReady, currentAccount, ticker, networkProperties } = props;
    const { transaction } = props.route.params;
    const [fetchPartialInfo, isPartialInfoLoading, partialInfo] = useDataManager(() => {
        //return TransactionService.fetchPartialInfo(transaction.id);
    }, null, handleError);
    const [fetchDate, isDateLoading, date] = useDataManager(async () => {
        const timestamp = await TransactionService.fetchDate(transaction.height, networkProperties);

        return formatDate(timestamp, $t, true);
    }, null);
    const [fetchStatus, isStatusLoading, status] = useDataManager(() => {
        return TransactionService.fetchStatus(transaction.hash || transaction.id, networkProperties);
    }, null);
    useInit(fetchDate, isWalletReady);
    useInit(fetchPartialInfo, isWalletReady);
    useInit(fetchStatus, isWalletReady);

    const isAggregate = isAggregateTransaction(transaction);
    let action = $t(`transactionDescriptor_${transaction.type}`);
    const styleAmount = [styles.textAmount];
    const statusTextStyle = [styles.statusText];
    const statusText = status?.group ? $t(`transactionStatus_${status.group}`) : '';
    let statusIconSrc;

    switch(status?.group) {
        case 'unconfirmed': 
            statusTextStyle.push(styles.statusTextUnconfirmed);
            statusIconSrc = require('src/assets/images/icon-status-unconfirmed.png');
            break;
        case 'partial': 
            statusTextStyle.push(styles.statusTextPartial);
            statusIconSrc = require('src/assets/images/icon-status-partial-2.png');
            break;
        case 'confirmed': 
            statusTextStyle.push(styles.statusTextConfirmed); 
            statusIconSrc = require('src/assets/images/icon-status-confirmed.png');
            break;
    }

    if (transaction.type === TransactionType.TRANSFER && isOutgoingTransaction(transaction, currentAccount)) {
        action = $t(`transactionDescriptor_${transaction.type}_outgoing`);
    }
    else if (transaction.type === TransactionType.TRANSFER && isIncomingTransaction(transaction, currentAccount)) {
        action = $t(`transactionDescriptor_${transaction.type}_incoming`);
    }

    if (transaction.amount < 0) {
        styleAmount.push(styles.outgoing);
    }
    else if (transaction.amount > 0) {
        styleAmount.push(styles.incoming);
    }

    const details = _.pick(transaction, ['height', 'hash', 'fee', 'signerAddress', 'receivedCosignatures'])

    return (
        <Screen>
            <ScrollView>
                <FormItem>
                    <StyledText type="title-large" style={styles.textAction}>{action}</StyledText>
                    <View style={[layout.row]}>
                        <FormItem clear="horizontal" style={styles.formItem}>
                            <StyledText type="label">Total</StyledText>
                            <StyledText style={styleAmount}>{transaction.amount} {ticker}</StyledText>
                        </FormItem>
                        <FormItem clear="horizontal" style={styles.formItem}>
                            <StyledText type="label">Status</StyledText>
                            <View style={styles.statusBadge}>
                                <Image source={statusIconSrc} style={styles.statusIcon} />
                                <Text style={statusTextStyle}>{statusText}</Text>
                            </View>
                        </FormItem>
                    </View>
                    <FormItem clear="horizontal" style={styles.date}>
                        {!!date && <StyledText type="label">Date</StyledText>}
                        {!!date && <StyledText type="body">{date}</StyledText>}
                        {isDateLoading && <LoadingIndicator size="sm" />}
                    </FormItem>
                </FormItem>
                {!isAggregate && (
                    <FormItem>
                        <TransactionGraphic transaction={transaction} />
                    </FormItem>
                )}   
                {isAggregate && (
                    <FormItem>
                        {isAggregate && transaction.innerTransactions.map((item, index) => (
                            <FormItem type='list' key={'inner' + index}>
                                <TransactionGraphic transaction={item} isExpandable />
                            </FormItem>
                        ))}
                    </FormItem>
                )} 
                <FormItem>
                    <TableView data={details} />
                </FormItem>
            </ScrollView>
        </Screen>
    );
});

const styles = StyleSheet.create({
    textAction: {
        maxWidth: '75%'
    },
    textAmount: {
        ...fonts.amount,
        color: colors.textBody
    },
    outgoing: {
        color: colors.danger
    },
    incoming: {
        color: colors.success
    },
    innerTransactionContainer: {
        backgroundColor: colors.bgForm,
        borderRadius: borders.borderRadius,
        padding: spacings.padding
    },
    date: {
        height: 30,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 40,
        borderRadius: borders.borderRadius,
        paddingHorizontal: spacings.margin,
        backgroundColor: colors.bgCard
    },
    statusText: {
        ...fonts.body,
        color: colors.textBody
    },
    statusTextUnconfirmed: {
        color: colors.warning
    },
    statusTextPartial: {
        color: colors.info
    },
    statusTextConfirmed: {
        color: colors.success
    },
    statusIcon: {
        width: 18,
        height: 18,
        marginRight: spacings.margin / 2
    },

    formItem: {
        flexDirection: 'column',
        flex: 1
    },
    formCard: {
        backgroundColor: colors.bgForm,
        borderRadius: borders.borderRadius,
        padding: spacings.padding,
        flex: 1
    }
});
