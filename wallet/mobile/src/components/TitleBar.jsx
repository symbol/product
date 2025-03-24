import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Router } from '@/app/Router';
import { borders, colors, fonts, spacings } from '@/app/styles';
import { trunc } from '@/app/utils';
import { AccountAvatar } from '@/app/components';
import Animated, { interpolate, useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';

export const TitleBar = (props) => {
    const { currentAccount, isLoading } = props;

    const isLoadingShared = useDerivedValue(() => withTiming(!!isLoading), [isLoading]);
    const animatedAvatarStyle = useAnimatedStyle(() => ({
        opacity: interpolate(isLoadingShared.value, [true, false], [0.3, 1]),
    }));

    const getAddress = () => trunc(currentAccount.address, 'address');
    const handleAccountPress = () => Router.goToAccountList();
    const handleSettingsPress = () => Router.goToSettings();

    return (
        <View style={styles.root}>
            <TouchableOpacity style={styles.accountSelector} onPress={handleAccountPress}>
                {!!currentAccount && (
                    <View style={styles.row}>
                        <Animated.View style={animatedAvatarStyle}>
                            <AccountAvatar size="sm" address={currentAccount.address} style={styles.avatar} />
                        </Animated.View>
                        <View>
                            <Text style={styles.textAccount}>{currentAccount.name}</Text>
                            <Text style={styles.textAddress}>{getAddress()}</Text>
                        </View>
                    </View>
                )}
                {isLoading && (
                    <View style={styles.loadingIndicator}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                )}
                <Image source={require('@/app/assets/images/icon-down.png')} style={styles.icon} />
            </TouchableOpacity>
            <TouchableOpacity hitSlop={10} onPress={handleSettingsPress}>
                <Image source={require('@/app/assets/images/icon-settings.png')} style={styles.icon} />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        width: '100%',
        height: 56,
        backgroundColor: colors.bgNavbar,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacings.margin,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
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
        paddingHorizontal: spacings.margin,
    },
    avatar: {
        marginRight: spacings.margin / 2,
    },
    textAccount: {
        ...fonts.label,
        color: colors.accentLightForm,
    },
    textAddress: {
        ...fonts.body,
        color: colors.controlBaseTextAlt,
    },
    icon: {
        width: 24,
        height: 24,
    },
    loadingIndicator: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 48,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    }
});
