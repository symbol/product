import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Router } from 'src/Router';
import { borders, colors, fonts, spacings } from 'src/styles';
import { trunc } from 'src/utils';

export const TitleBar = props => {
    const { currentAccount } = props;

    const getAddress = () => trunc(currentAccount.address, 'address');
    const handleAccountPress = Router.goToAccountList;
    const handleSettingsPress = Router.goToSettings;
    
    return (
        <View style={styles.root}>
            <TouchableOpacity style={styles.accountSelector} onPress={handleAccountPress}>
                {!!currentAccount && (
                    <View>
                        <Text style={styles.textAccount}>{currentAccount.name}</Text>
                        <Text style={styles.textAddress}>{getAddress()}</Text>
                    </View>
                )}
                {!currentAccount && (
                    <ActivityIndicator color={colors.primary} />
                )}
                <Image source={require('src/assets/images/icon-down.png')} style={styles.icon} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSettingsPress}>
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
    accountSelector: {
        width: '60%',
        height: 41,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: borders.borderRadiusAccountSelector,
        borderWidth: 1,
        borderColor: colors.controlBaseStroke,
        paddingHorizontal: spacings.padding
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
