import _ from 'lodash';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import { Screen, TitleBar, TabNavigator, StyledText, ItemTransaction, ItemTransactionPlaceholder, FormItem, TableView } from 'src/components';
import { $t } from 'src/localization';
import { TransactionService } from 'src/services';
import store, { connect } from 'src/store';
import { colors, spacings } from 'src/styles';
import { handleError, isIncomingTransaction, isOutgoingTransaction, useDataManager, useInit } from 'src/utils';
import { TransactionType } from 'symbol-sdk';

export const TransactionDetails = connect(state => ({
    isWalletReady: state.wallet.isReady,
    currentAccount: state.account.current,
    ticker: state.network.ticker,
}))(function TransactionDetails(props) {
    const { isWalletReady, currentAccount, ticker } = props;
    const { transaction } = props.route.params;
    const [fetchPartialInfo, isPartialInfoLoading, partialInfo] = useDataManager(() => {
        //return TransactionService.fetchPartialInfo(transaction.id);
    }, null, handleError);
    const [fetchDate, isDateLoading, date] = useDataManager(() => {
        //return TransactionService.fetchDate(transaction.height);
    }, null, handleError);
    useInit(fetchDate, isWalletReady);
    useInit(fetchPartialInfo, isWalletReady);

    const tableData = _.omit(transaction, 'amount', 'id')
    let amountText = '';
    let action = $t(`transactionDescriptor_${transaction.type}`);
    const styleAmount = [styles.textAmount];

    if (transaction.type === TransactionType.TRANSFER && isOutgoingTransaction(transaction, currentAccount)) {
        action = $t(`transactionDescriptor_${transaction.type}_outgoing`);
    }
    else if (transaction.type === TransactionType.TRANSFER && isIncomingTransaction(transaction, currentAccount)) {
        action = $t(`transactionDescriptor_${transaction.type}_incoming`);
    }

    if (transaction.amount < 0) {
        amountText = `${transaction.amount} ${ticker}`;
        styleAmount.push(styles.outgoing);
    }
    else if (transaction.amount > 0) {
        amountText = `${transaction.amount} ${ticker}`;
        styleAmount.push(styles.incoming);
    }

    return (
        <Screen>
            <FormItem>
                <StyledText type="title-large" style={styles.textAction}>{action}</StyledText>
                <StyledText type="subtitle" style={styleAmount}>{amountText}</StyledText>
            </FormItem>
            <TableView data={tableData} />
        </Screen>
    );
});

const styles = StyleSheet.create({
    textAction: {
        maxWidth: '75%'
    },
    textAmount: {
        color: colors.textBody
    },
    outgoing: {
        color: colors.danger
    },
    incoming: {
        color: colors.success
    },
});
