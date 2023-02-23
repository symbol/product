import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { ItemBase } from 'src/components';
import { $t } from 'src/localization';
import { connect } from 'src/store';
import { colors, fonts, spacings } from 'src/styles';
import { formatDate } from 'src/utils';

export const ItemReceipt = connect((state) => ({
    ticker: state.network.ticker,
}))(function ItemReceipt(props) {
    const { receipt, ticker, onPress } = props;
    const { amount, date, height } = receipt;
    const dateText = formatDate(date, $t);
    const description = `Block #${height}`;
    const amountText = `${amount} ${ticker}`;
    const iconSrc = require('src/assets/images/icon-harvesting.png');
    const title = 'Harvesting Reward'//$t(`transactionDescriptor_16724`);

    return (
        <ItemBase contentContainerStyle={styles.root} isLayoutAnimationEnabled onPress={onPress}>
            <View style={styles.sectionIcon}>
                <Image source={iconSrc} style={styles.icon} />
            </View>
            <View style={styles.sectionMiddle}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.description}>{description}</Text>
                <View style={styles.rowAmount}>
                    <Text style={styles.date}>{dateText}</Text>
                    <Text style={styles.amount}>{amountText}</Text>
                </View>
            </View>
        </ItemBase>
    );
});

const styles = StyleSheet.create({
    root: {
        flexDirection: 'row',
        width: '100%',
        minHeight: 75,
    },
    icon: {
        height: 24,
        width: 24,
    },
    title: {
        ...fonts.subtitle,
        color: colors.textBody,
    },
    description: {
        ...fonts.body,
        color: colors.textBody,
    },
    date: {
        ...fonts.body,
        color: colors.textBody,
        fontSize: 10,
        opacity: 0.7,
        textAlignVertical: 'center',
    },
    amount: {
        ...fonts.bodyBold,
        color: colors.success,
    },
    sectionIcon: {
        flexDirection: 'column',
        justifyContent: 'center',
        paddingRight: spacings.padding,
    },
    sectionMiddle: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'space-between',
    },
    rowAmount: {
        alignSelf: 'stretch',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
});
