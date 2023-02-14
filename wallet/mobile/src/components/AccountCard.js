import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { borders, colors, fonts, layout, spacings } from 'src/styles';
import { getCharPercentage } from 'src/utils';
import { AccountAvatar } from 'src/components';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { $t } from 'src/localization';

const imagesPattern = [
    require('src/assets/images/Geometric-02.png'),
    require('src/assets/images/Geometric-03.png'),
    require('src/assets/images/Geometric-08.png'),
    require('src/assets/images/Geometric-10.png'),
    require('src/assets/images/Geometric-12.png'),
    require('src/assets/images/Geometric-04.png'),
    require('src/assets/images/Geometric-14.png'),
    require('src/assets/images/Geometric-16.png'),
    require('src/assets/images/Geometric-05.png'),
];

export const AccountCard = (props) => {
    const { address, balance, name, ticker, isLoading, isActive, type, onRemove } = props;
    const stylesRootActive = isActive ? [styles.root, styles.rootSimplifiedActive] : [styles.root, styles.rootSimplifiedInactive];
    const stylesRoot = [stylesRootActive, styles.clearMarginTop];
    const stylesContent = [styles.content, styles.clearMarginTop];
    const stylesPattern = [styles.pattern];
    const removeIconSrc = type === 'seed' ? require('src/assets/images/icon-hide.png') : require('src/assets/images/icon-delete.png');

    let imagePattern;

    if (address?.length < 4) {
        imagePattern = null;
    } else {
        const char1 = address[3];
        const char2 = address[address.length - 1];
        const char3 = address[address.length - 2];
        const patternIndex = Math.round(getCharPercentage(char1) * 8);
        imagePattern = imagesPattern[patternIndex];
        const left = `-${Math.trunc(getCharPercentage(char2) * 100)}%`;
        const top = `-${Math.trunc(getCharPercentage(char3) * 100)}%`;
        stylesPattern.push({ left, top });
    }

    return (
        <View style={stylesRoot}>
            <View style={styles.patternWrapper}>
                <Image source={imagePattern} style={stylesPattern} />
            </View>
            {isLoading && <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />}
            <View style={styles.manageSection} onTouchEnd={(e) => e.stopPropagation()}>
                {!!onRemove && (
                    <TouchableOpacity hitSlop={15} onPress={onRemove}>
                        <Image source={removeIconSrc} style={styles.removeIcon} />
                    </TouchableOpacity>
                )}
                <AccountAvatar size="sm" address={address} />
            </View>
            <View style={stylesContent}>
                <Text style={styles.textTitle}>{$t('c_accountCard_title_account')}</Text>
                <Text style={styles.textName}>{name}</Text>
                <Text style={styles.textTitle}>{$t('c_accountCard_title_balance')}</Text>
                <View style={[layout.row, layout.alignEnd]}>
                    <Text style={styles.textBalance}>{balance}</Text>
                    <Text style={styles.textTicker}>{' ' + ticker}</Text>
                </View>
                <Text style={styles.textTitle}>{$t('c_accountCard_title_address')}</Text>
                <View style={layout.row}>
                    <Text style={styles.textAddress}>{address}</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        position: 'relative',
        width: '100%',
        borderRadius: borders.borderRadiusForm,
        borderWidth: borders.borderWidth,
    },
    rootSimplifiedInactive: {
        backgroundColor: colors.bgAccountCard,
        borderColor: colors.secondary,
    },
    rootSimplifiedActive: {
        backgroundColor: colors.bgAccountCardSelected,
        borderColor: colors.accentLightForm,
    },
    patternWrapper: {
        overflow: 'hidden',
        position: 'absolute',
        width: '100%',
        height: '100%',
    },
    pattern: {
        position: 'absolute',
        height: '200%',
        top: 0,
        left: 0,
        opacity: 0.05,
    },
    manageSection: {
        position: 'absolute',
        top: spacings.margin,
        right: spacings.margin,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 2,
    },
    removeIcon: {
        width: 18,
        height: 18,
        marginRight: spacings.margin / 2,
    },
    loadingIndicator: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#0001',
    },
    content: {
        width: '100%',
        paddingHorizontal: spacings.padding,
        paddingBottom: spacings.padding2,
    },
    textTitle: {
        ...fonts.label,
        marginTop: spacings.margin,
        opacity: 0.7,
        color: colors.textForm,
    },
    textName: {
        ...fonts.title,
        color: colors.textForm,
    },
    textBalance: {
        ...fonts.body,
        fontSize: 36,
        lineHeight: 40,
        color: colors.textForm,
    },
    textTicker: {
        ...fonts.body,
        fontSize: 16,
        lineHeight: 28,
        color: colors.textForm,
    },
    textAddress: {
        ...fonts.body,
        color: colors.textForm,
        marginRight: spacings.margin / 2,
    },
});
