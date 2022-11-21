import React from 'react';
import { Image, View, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { borders, colors, fonts, layout, spacings, timings } from 'src/styles';
import imageArtPassport from 'src/assets/images/art-passport.png';

export const AccountCard = props => {
    const { address, balance, name, ticker, isLoading, isSimplified, isActive, onReceivePress, onSendPress, onScanPress } = props;
    const stylesRootActive = isActive ? [styles.root, styles.rootActive] : [styles.root];
    const stylesRoot = isSimplified ? [stylesRootActive, styles.clearMarginTop] : [stylesRootActive];
    const stylesContent = isSimplified ? [styles.content, styles.clearMarginTop] : [styles.content];
    
    return (
        <View style={stylesRoot}>
            {!isSimplified && <Image source={imageArtPassport} style={styles.art} />}
            {isLoading && <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />}
            <View style={stylesContent}>
                <Text style={styles.textTitle}>
                    {/* notranslate  */}
                    Account
                </Text>
                <Text style={styles.textName}>
                    {name}
                </Text>
                <Text style={styles.textTitle}>
                    {/* notranslate  */}
                    Balance
                </Text>
                <View style={{...layout.row, ...layout.alignEnd}}>
                    <Text style={styles.textBalance}>
                        {balance}
                    </Text>
                    <Text style={styles.textTicker}>
                        {' ' + ticker}
                    </Text>
                </View>
                <Text style={styles.textTitle}>
                    {/* notranslate  */}
                    Address
                </Text>
                <Text style={styles.textAddress}>
                    {address}
                </Text>
            </View>
            {!isSimplified && (
                <View style={styles.controls}>
                    <View style={styles.button}>
                        <TouchableOpacity onPress={onReceivePress} style={styles.buttonPressable}>
                            <Text style={styles.textButton}>
                                {/* notranslate  */}
                                Receive
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.button}>
                        <TouchableOpacity onPress={onSendPress} style={styles.buttonPressable}>
                            <Text style={styles.textButton}>
                                {/* notranslate  */}
                                Send
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <View style={[styles.button, styles.clearBorderRight]}>
                        <TouchableOpacity onPress={onScanPress} style={styles.buttonPressable}>
                            <Text style={styles.textButton}>
                                {/* notranslate  */}
                                Scan
                            </Text>
                        </TouchableOpacity>
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
        backgroundColor: colors.bgForm,
        borderRadius: borders.borderRadiusForm,
        borderStyle: 'solid',
        marginTop: 58,
    },
    rootActive: {
        backgroundColor: colors.accentLightForm,
    },
    art: {
        position: 'absolute',
        height: 201,
        width: 260,
        right: 0,
        top: -58,
        resizeMode: 'stretch'
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
    },
    controls: {
        flexDirection: 'row',
        backgroundColor: colors.accentForm,
        borderBottomLeftRadius: borders.borderRadiusForm,
        borderBottomRightRadius: borders.borderRadiusForm,
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
    }
});
