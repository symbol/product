import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, Touchable, TouchableOpacity, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { borders, colors, fonts, spacings, timings } from 'src/styles';
import { trunc } from 'src/utils';


export const TitleBar = props => {
    const { back, settings, accountSelector, currentAccount, style } = props;
    const navigation = useNavigation();

    const getAddress = () => trunc(currentAccount.address, 'address');
    const handleBackPress = () => {
        navigation.goBack();
    }
    const handleAccountPress = () => {
        navigation.navigate('AccountList');
    }
    const handleSettingsPress = () => {
        navigation.navigate('Settings');
    }
    

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
