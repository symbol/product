import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Router } from 'src/Router';
import { borders, colors, fonts, spacings } from 'src/styles';
import { trunc } from 'src/utils';
import { AccountAvatar } from 'src/components';

export const TitleBar = props => {
    const { currentAccount } = props;

    const getAddress = () => trunc(currentAccount.address, 'address');
    const handleAccountPress = Router.goToAccountList;
    const handleSettingsPress = Router.goToSettings;
    
    return (
        <View style={styles.root}>
            <TouchableOpacity style={styles.accountSelector} onPress={handleAccountPress}>
                {!!currentAccount && (
                    <View style={styles.row}>
                        <AccountAvatar size="sm" address={currentAccount.address} style={styles.avatar} />
                        <View>
                            <Text style={styles.textAccount}>{currentAccount.name}</Text>
                            <Text style={styles.textAddress}>{getAddress()}</Text>
                        </View>
                    </View>
                )}
                {!currentAccount && (
                    <ActivityIndicator color={colors.primary} />
                )}
                <Image source={require('src/assets/images/icon-down.png')} style={styles.icon} />
            </TouchableOpacity>
            <TouchableOpacity hitSlop={10} onPress={handleSettingsPress}>
                <Image source={require('src/assets/images/icon-settings.png')} style={styles.icon} />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        width: '100%',
        height: 48,
        backgroundColor: colors.bgNavbar,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacings.margin
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    accountSelector: {
        width: '60%',
        height: 41,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: borders.borderRadiusAccountSelector,
        borderWidth: 1,
        borderColor: colors.controlBaseStroke,
        paddingHorizontal: spacings.margin
    },
    avatar: {
        marginRight: spacings.margin / 2
    },
    textAccount: {
        ...fonts.label,
        color: colors.accentLightForm
    },
    textAddress: {
        ...fonts.body,
        color: colors.controlBaseTextAlt
    },
    icon: {
        width: 24,
        height: 24,
    }
});
