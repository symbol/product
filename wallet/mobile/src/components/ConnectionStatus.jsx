import { observer } from 'mobx-react-lite';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, fonts } from '@/app/styles';
import Animated, {
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useDerivedValue,
    withTiming,
} from 'react-native-reanimated';
import { $t } from '@/app/localization';
import WalletController from '@/app/lib/controller/MobileWalletController';
import { NetworkConnectionStatus } from '@/app/constants';

export const ConnectionStatus = observer(function ConnectionStatus() {
    const { networkStatus } = WalletController;
    const statusTextMap = {
        [NetworkConnectionStatus.INITIAL]: $t('c_connectionStatus_connecting'),
        [NetworkConnectionStatus.CONNECTING]: $t('c_connectionStatus_connecting'),
        [NetworkConnectionStatus.CONNECTED]: $t('c_connectionStatus_connected'),
        [NetworkConnectionStatus.NO_INTERNET]: $t('c_connectionStatus_offline'),
        [NetworkConnectionStatus.FAILED_CUSTOM_NODE]: $t('c_connectionStatus_nodeDown'),
    };
    const statusText = statusTextMap[networkStatus];;
    const statusColors = [colors.info, colors.warning, colors.danger];
    const color = useDerivedValue(() => {
        const value =
            networkStatus === NetworkConnectionStatus.FAILED_CUSTOM_NODE ? 2 : networkStatus === NetworkConnectionStatus.CONNECTED ? 0 : 1;
        return withTiming(value);
    }, [networkStatus]);
    const isShown = useDerivedValue(() => {
        const value = networkStatus === NetworkConnectionStatus.CONNECTED ? false : true;
        return withTiming(value);
    }, [networkStatus]);
    const animatedContainer = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(color.value, [0, 1, 2], [statusColors[0], statusColors[1], statusColors[2]]),
        height: interpolate(isShown.value, [true, false], [12, 0]),
    }));

    return (
        <Animated.View style={[styles.root, animatedContainer]}>
            <Text style={styles.text}>{statusText}</Text>
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    root: {
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        ...fonts.bodyBold,
        fontSize: 10,
        color: colors.bgNavbar,
    },
});
