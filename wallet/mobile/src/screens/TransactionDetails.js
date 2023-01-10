import _ from 'lodash';
import React from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Screen, StyledText, FormItem, TableView, TransactionGraphic, LoadingIndicator, ButtonPlain } from 'src/components';
import { config } from 'src/config';
import { $t } from 'src/localization';
import { TransactionService } from 'src/services';
import { connect } from 'src/store';
import { borders, colors, fonts, spacings } from 'src/styles';
import { formatDate, handleError, isAggregateTransaction, isIncomingTransaction, isOutgoingTransaction, useDataManager, useInit } from 'src/utils';
import { TransactionType } from 'symbol-sdk';


export const TransactionDetails = connect(state => ({
    isWalletReady: state.wallet.isReady,
    currentAccount: state.account.current,
    ticker: state.network.ticker,
    networkIdentifier: state.network.networkIdentifier,
    networkProperties: state.network.networkProperties,
}))(function TransactionDetails(props) {
    const { isWalletReady, currentAccount, ticker, networkIdentifier, networkProperties } = props;
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

    const details = _.pick(transaction, ['height', 'hash', 'fee', 'signerAddress', 'receivedCosignatures']);

    const openBlockExplorer = () => Linking.openURL(config.explorerURL[networkIdentifier] + '/transactions/' + transaction.hash)

    return (
        <Screen>
            <ScrollView>
                <FormItem>
                    <StyledText type="title-large" style={styles.textAction}>{action}</StyledText>
                    <View>
                        <FormItem clear="horizontal" style={styles.formItem}>
                            <StyledText type="label">Amount</StyledText>
                            <StyledText style={styleAmount}>{transaction.amount || 0} {ticker}</StyledText>
                        </FormItem>
                    </View>
                    <View style={styles.statusDateRow}>    
                        <FormItem clear="horizontal" style={styles.formItem}>
                            <StyledText type="label">Status</StyledText>
                            <View style={styles.statusBadge}>
                                <Image source={statusIconSrc} style={styles.statusIcon} />
                                <Text style={statusTextStyle}>{statusText}</Text>
                            </View>
                        </FormItem>
                        <FormItem clear="horizontal" style={styles.date}>
                            {!!date && <StyledText type="label">Date</StyledText>}
                            {!!date && <StyledText type="body">{date}</StyledText>}
                        </FormItem>
                        {isStatusLoading && <LoadingIndicator size="sm" />}
                    </View>
                </FormItem>
                {!isAggregate && (
                    <FormItem>
                        <TransactionGraphic transaction={transaction} isExpanded />
                    </FormItem>
                )}   
                {isAggregate && (
                    <FormItem>
                        {isAggregate && transaction.innerTransactions.map((item, index) => (
                            <FormItem type='list' key={'inner' + index}>
                                <TransactionGraphic transaction={item} />
                            </FormItem>
                        ))}
                    </FormItem>
                )} 
                <FormItem>
                    <TableView data={details} currentAccount={currentAccount}/>
                </FormItem>
                <FormItem>
                    <ButtonPlain title={$t('button_openTransactionInExplorer')} onPress={openBlockExplorer} />
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
    statusDateRow: {
        flexDirection: 'row',
        position: 'relative',
    },
    date: {
        marginLeft: spacings.margin,
        height: 30,
        width: '50%'
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        // height: 40,
        // borderRadius: borders.borderRadius,
        // paddingHorizontal: spacings.margin,
        // backgroundColor: colors.bgCard
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
