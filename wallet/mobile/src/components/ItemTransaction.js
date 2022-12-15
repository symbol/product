import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { connect } from 'src/store';
import { borders, colors, fonts, spacings } from 'src/styles';
import { isAggregateTransaction, isIncomingTransaction, isOutgoingTransaction, trunc } from 'src/utils';
import { TransactionType } from 'symbol-sdk';
import { FormItem } from './FormItem';

export const ItemTransaction = connect(state => ({
    currentAccount: state.account.current,
    ticker: state.network.ticker,
}))(function ItemTransaction(props) {
    const { currentAccount, group, transaction, ticker } = props;
    const { type, date, amount, signerAddress, recipientAddress } = transaction;
    let iconSrc;
    let action = 'Unknown';
    let description = '';
    let amountText = '';
    const styleAmount = [styles.textAmount];
    const styleRoot = [styles.root];

    if (amount < 0) {
        amountText = `${amount} ${ticker}`;
        styleAmount.push(styles.outgoing);
    }
    else if (amount > 0) {
        amountText = `${amount} ${ticker}`;
        styleAmount.push(styles.incoming);
    }

    if (type === TransactionType.TRANSFER && isOutgoingTransaction(transaction, currentAccount)) {
        action = 'Sent';
        description = `To * ${trunc(recipientAddress, 'address')}`;
        iconSrc = require('src/assets/images/icon-tx-transfer.png');
    }
    else if (type === TransactionType.TRANSFER && isIncomingTransaction(transaction, currentAccount)) {
        action = 'Received';
        description = `From * ${trunc(signerAddress, 'address')}`;
        iconSrc = require('src/assets/images/icon-tx-transfer.png');
    }
    else if (isAggregateTransaction(transaction)) {
        action = 'Aggregate';
        description = `Contains ${transaction.innerTransactions.length} embedded transactions`;
        iconSrc = require('src/assets/images/icon-tx-aggregate.png');
    }
    else if (type === TransactionType.NAMESPACE_REGISTRATION) {
        action = 'Namespace';
        description = `Registered * ${transaction.namespaceName}`;
        iconSrc = require('src/assets/images/icon-tx-namespace.png');
    }
    else if (type === TransactionType.MOSAIC_ALIAS || type === TransactionType.ADDRESS_ALIAS) {
        action = 'Namespace';
        const target = transaction.mosaicId || transaction.address;
        description = `Link ${transaction.namespaceName} * to ${trunc(target, 'address')}`;
        iconSrc = require('src/assets/images/icon-tx-namespace.png');
    }

    if (group === 'unconfirmed') {
        iconSrc = require('src/assets/images/icon-tx-unconfirmed.png');
        styleRoot.push(styles.rootUnconfirmed)
    }
    else if (group === 'partial') {
        styleRoot.push(styles.rootPartial)
    }

    return (
        <FormItem type="list">
            {/* TODO: uncomment when issue is fixed https://github.com/react-navigation/react-navigation/issues/10531 */}
            {/* <Animated.View entering={FadeInUp.duration(500)}> */}
                <View style={styleRoot}>
                    <View style={styles.sectionIcon}>
                        <Image source={iconSrc} style={styles.icon} />
                    </View>
                    <View style={styles.sectionMiddle}>
                        <Text style={styles.textAction}>{action}</Text>
                        <Text style={styles.textDescription}>{description}</Text>
                        <View style={styles.rowAmount}>
                            <Text style={styles.textDate}>{date}</Text>
                            <Text style={styleAmount}>{amountText}</Text>
                        </View>
                    </View>
                </View>
            {/* </Animated.View> */}
        </FormItem>
    );
});

const styles = StyleSheet.create({
    root: {
        flexDirection: 'row',
        width: '100%',
        minHeight: 62,
        backgroundColor: colors.bgCard,
        borderColor: colors.bgCard,
        borderWidth: borders.borderWidth,
        borderRadius: borders.borderRadius,
        padding: spacings.paddingSm
    },
    rootPartial: {
        borderColor: colors.neutral
    },
    rootUnconfirmed: {
        borderColor: colors.warning
    },
    icon: {
        height: 24,
        width: 24
    },
    textAction: {
        ...fonts.subtitle,
        color: colors.textBody
    },
    textDescription: {
        ...fonts.body,
        color: colors.textBody
    },
    textDate: {
        ...fonts.body,
        color: colors.textBody
    },
    textAmount: {
        ...fonts.bodyBold,
        color: colors.textBody
    },
    outgoing: {
        color: colors.danger
    },
    incoming: {
        color: colors.success
    },
    sectionIcon: {
        flexDirection: 'column',
        justifyContent: 'center',
        paddingRight: spacings.padding
    },
    sectionMiddle: {
        flex: 1,
        flexDirection: 'column',
    },
    rowAmount: {
        alignSelf: 'stretch',
        flexDirection: 'row',
        justifyContent: 'space-between'
    }
});
