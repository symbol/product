import React from 'react';
import { Image, View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { borders, colors, fonts, layout, spacings } from 'src/styles';
import imageArtPassport from 'src/assets/images/art-passport.png';
import { getCharPercentage } from 'src/utils';
import { AccountAvatar, ButtonCopy, TouchableNative } from 'src/components';
import { TouchableOpacity } from 'react-native-gesture-handler';

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

export const AccountCard = props => {
    const { address, balance, name, ticker, isLoading, isSimplified, isActive, onReceivePress, onSendPress, onDetailsPress, type, onRemove } = props;
    const stylesRootActive = isActive ? [styles.root, styles.rootSimplifiedActive] : [styles.root, styles.rootSimplifiedInactive];
    const stylesRoot = isSimplified ? [stylesRootActive, styles.clearMarginTop] : [styles.root];
    const stylesContent = isSimplified ? [styles.content, styles.clearMarginTop] : [styles.content];
    const stylesPattern = [styles.pattern];
    const touchableBackground = colors.accentLightForm;
    const removeIconSrc = type === 'seed'
        ? require('src/assets/images/icon-hide.png')
        : require('src/assets/images/icon-delete.png');

    let imagePattern;

    if (address?.length < 4) {
        imagePattern = null;
    }
    else {
        const patternIndex = Math.round(getCharPercentage(address[3]) * 8);
        imagePattern = imagesPattern[patternIndex];
        const left = `-${Math.trunc(getCharPercentage(address[address.length - 1]) * 100)}%`;
        const top = `-${Math.trunc(getCharPercentage(address[address.length - 2]) * 100)}%`;
        stylesPattern.push({left, top})
    }

    return (
        <View style={stylesRoot}>
            <View style={styles.patternWrapper}>
                {isSimplified && <Image source={imagePattern} style={stylesPattern} />}
            </View>
            {!isSimplified && <Image source={imageArtPassport} style={styles.art} />}
            {isLoading && <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />}
            {isSimplified && (
                <View style={styles.manageSection} onTouchEnd={(e) => e.stopPropagation()}>
                    {!!onRemove && (
                        <TouchableOpacity hitSlop={15} onPress={onRemove}>
                            <Image source={removeIconSrc} style={styles.removeIcon}/>
                        </TouchableOpacity>
                    )}
                    <AccountAvatar size="sm" address={address}/>
                </View>
            )}
            <View style={stylesContent}>
                <Text style={styles.textTitle}>{/* notranslate  */}Account</Text>
                <Text style={styles.textName}>{name}</Text>
                <Text style={styles.textTitle}>{/* notranslate  */}Balance</Text>
                <View style={{...layout.row, ...layout.alignEnd}}>
                    <Text style={styles.textBalance}>{balance}</Text>
                    <Text style={styles.textTicker}>{' ' + ticker}</Text>
                </View>
                <Text style={styles.textTitle}>{/* notranslate  */}Address</Text>
                <View style={styles.row}>
                    <Text style={styles.textAddress}>{address}</Text>
                    {!isSimplified && <ButtonCopy content={address} />}
                </View>
            </View>
            {!isSimplified && (
                <View style={styles.controls}>
                    <View style={styles.button}>
                        <TouchableNative color={touchableBackground} onPress={onDetailsPress} style={styles.buttonPressable}>
                            <Image source={require('src/assets/images/icon-wallet.png')} style={styles.icon}/>
                            <Text style={styles.textButton}>
                                {/* notranslate  */}
                                Details
                            </Text>
                        </TouchableNative>
                    </View>
                    <View style={styles.button}>
                        <TouchableNative color={touchableBackground} onPress={onSendPress} style={styles.buttonPressable}>
                            <Image source={require('src/assets/images/icon-send.png')} style={styles.icon}/>
                            <Text style={styles.textButton}>
                                {/* notranslate  */}
                                Send
                            </Text>
                        </TouchableNative>
                    </View>
                    <View style={[styles.button, styles.clearBorderRight]}>
                        <TouchableNative color={touchableBackground} onPress={onReceivePress} style={styles.buttonPressable}>
                            <Image source={require('src/assets/images/icon-receive.png')} style={styles.icon}/>
                            <Text style={styles.textButton}>
                                {/* notranslate  */}
                                Receive
                            </Text>
                        </TouchableNative>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        position: 'relative',
        width: '100%',
        backgroundColor: colors.accentLightForm,
        borderRadius: borders.borderRadiusForm,
        marginTop: 58,
    },
    rootSimplifiedInactive: {
        backgroundColor: colors.bgAccountCard,
        borderWidth: borders.borderWidth,
        borderColor: colors.secondary
    },
    rootSimplifiedActive: {
        backgroundColor: colors.bgAccountCardSelected,
        borderWidth: borders.borderWidth,
        borderColor: colors.accentLightForm
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
        opacity: 0.05
    },
    art: {
        position: 'absolute',
        height: 201,
        width: 260,
        right: 0,
        top: -58,
        resizeMode: 'stretch'
    },
    manageSection: {
        position: 'absolute',
        top: spacings.margin,
        right: spacings.margin,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 2
    },
    removeIcon: {
        width: 18,
        height: 18,
        marginRight: spacings.margin / 2
    },
    loadingIndicator: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#0001'
    },
    content: {
        width: '100%',
        marginTop: 81,
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
        marginRight: spacings.margin / 2
    },
    controls: {
        flexDirection: 'row',
        backgroundColor: colors.accentForm,
        borderBottomLeftRadius: borders.borderRadiusForm,
        borderBottomRightRadius: borders.borderRadiusForm,
        overflow: 'hidden'
    },
    button: {
        height: 48,
        flex: 1,
        borderRightColor: colors.accentLightForm,
        borderRightWidth: 1,
    },
    buttonPressable: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row'
    },
    icon: {
        width: 18,
        height: 18,
        marginRight: spacings.paddingSm / 2
    },
    textButton: {
        ...fonts.button,
        fontSize: 15,
        color: colors.textForm,
    },
    clearBorderRight: {
        borderRightWidth: null
    },
    clearMarginTop: {
        marginTop: 0
    },
    row: {
        flexDirection: 'row'
    }
});
