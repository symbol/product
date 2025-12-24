import { ItemBase } from '@/app/components';
import { TokenIcon } from '@/app/screens/bridge/components/TokenIcon';
import { colors, fonts, spacings } from '@/app/styles';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const KNOWN_TOKEN_TITLES = {
    'ethereum:wxym': 'Wrapped XYM',
    'ethereum:eth': 'Ether',
    'symbol:symbol.xym': 'Symbol XYM',
}

export const TokenItem = props => {
    const { title, token, chainName, onPress } = props;
    const { amount, name } = token;
    const titleKey = chainName.toLowerCase() + ':' + name.toLowerCase();
    const titleText = title || KNOWN_TOKEN_TITLES[titleKey];

    return (
        <ItemBase contentContainerStyle={styles.root} onPress={onPress}>
            <View style={styles.sectionIcon}>
                <TokenIcon tokenName={name} chainName={chainName} />
            </View>
            <View style={styles.sectionMiddle}>
                <Text style={styles.title}>{titleText}</Text>
                <View style={styles.rowAmount}>
                    <Text style={styles.amount}>{amount}</Text>
                    <Text style={styles.ticker}>{name}</Text>
                </View>
            </View>
        </ItemBase>
    );
};

const styles = StyleSheet.create({
    root: {
        flexDirection: 'row',
        width: '100%',
        minHeight: 75
    },
    title: {
        ...fonts.bodyBold,
        color: colors.textBody
    },
    amount: {
        ...fonts.title,
        color: colors.textBody
    },
    ticker: {
        ...fonts.body,
        color: colors.textBody,
        opacity: 0.7
    },
    sectionIcon: {
        flexDirection: 'column',
        justifyContent: 'center',
        paddingHorizontal: spacings.paddingSm
    },
    sectionMiddle: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
    },
    rowAmount: {
        alignItems: 'baseline',
        flexDirection: 'row',
        gap: spacings.padding / 2,
    },
});
