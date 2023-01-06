import _ from 'lodash';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { AccountAvatar, Screen, StyledText, FormItem, TableView } from 'src/components';
import { $t } from 'src/localization';
import { connect } from 'src/store';
import { borders, colors, fonts, spacings } from 'src/styles';
import { getColorFromHash, handleError, isIncomingTransaction, isOutgoingTransaction, useDataManager, useInit } from 'src/utils';
import { TransactionType } from 'symbol-sdk';

const TransactionGraphic = (props) => {
    const { transaction } = props;

    const signerNameColorStyle = {
        color: getColorFromHash(transaction.signerAddress)
    }
    const signerNameStyle = [styles2.signerName, signerNameColorStyle];
    const targetNameStyle = [styles2.targetName];

    let Target = () => null;
    let targetName = '';
    const actionText = $t(`transactionDescriptor_${transaction.type}`);
    let ActionBody = () => null

    switch(transaction.type) {
        case TransactionType.TRANSFER:
            Target = () => <AccountAvatar address={transaction.recipientAddress} size="md" />
            targetName = transaction.recipientAddress;
            targetNameStyle.push({
                color: getColorFromHash(transaction.recipientAddress)
            });
            ActionBody = () => <Text style={styles2.action}>{Math.abs(transaction.amount)} XYM</Text>
            break;
    }

    return (
        <View style={styles2.root}>
            <Text style={signerNameStyle}>{transaction.signerAddress}</Text>
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
        </View>
    );
}

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
});



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

    const formatData = data => _.omit(data, 'amount', 'id', 'innerTransactions', 'cosignaturePublicKeys', 'deadline');

    return (
        <Screen>
            <ScrollView>
                <FormItem>
                    <StyledText type="title-large" style={styles.textAction}>{action}</StyledText>
                    <StyledText style={styleAmount}>{amountText}</StyledText>
                </FormItem>
                <FormItem>
                    <TransactionGraphic transaction={transaction} />
                </FormItem>
                {true && <FormItem>
                    <StyledText type="title">Details</StyledText>
                    <TableView data={formatData(transaction)} />
                </FormItem>}
                {!!transaction.innerTransactions && (
                    <FormItem>
                        <StyledText type="title">Inner Transactions</StyledText>
                        {transaction.innerTransactions.map((item, index) => (
                            <FormItem type='list' key={'inner' + index} style={styles.innerTransactionContainer}>
                                <StyledText type="subtitle">Transaction {index + 1}</StyledText>
                                <TableView data={formatData(item)}/>
                            </FormItem>
                        ))}
                    </FormItem>
                )}
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
    statusBox: {
        backgroundColor: colors.bgForm,
        borderRadius: borders.borderRadius
    },
    innerTransactionContainer: {
        backgroundColor: colors.bgForm,
        borderRadius: borders.borderRadius,
        padding: spacings.padding
    }
});
