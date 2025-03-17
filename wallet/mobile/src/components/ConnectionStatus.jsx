import { observer } from 'mobx-react-lite';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, fonts, timings } from '@/app/styles';
import Animated, {
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { $t } from '@/app/localization';
import WalletController from '@/app/lib/controller/MobileWalletController';
import { NetworkConnectionStatus } from '@/app/constants';

export const ConnectionStatus = observer(function ConnectionStatus() {
    const { networkStatus } = WalletController;
    const [statusText, setStatusText] = useState($t('c_connectionStatus_connecting'));
    const statusColors = [colors.info, colors.warning, colors.danger];
    const isShown = useSharedValue(true);
    const color = useDerivedValue(() => {
        const value =
            networkStatus === NetworkConnectionStatus.FAILED_CURRENT_NODE ? 2 : networkStatus === NetworkConnectionStatus.CONNECTED ? 0 : 1;
        return withTiming(value);
    });

    const updateValue = () => {
        switch (networkStatus) {
            case NetworkConnectionStatus.NO_INTERNET:
                setStatusText($t('c_connectionStatus_offline'));
                isShown.value = withTiming(true, timings.press);
                break;
            case NetworkConnectionStatus.FAILED_CURRENT_NODE:
                setStatusText($t('c_connectionStatus_nodeDown'));
                isShown.value = withTiming(true, timings.press);
                break;
            case NetworkConnectionStatus.CONNECTED:
                setStatusText($t('c_connectionStatus_connected'));
                isShown.value = withTiming(false, timings.press);
                break;
            default:
                isShown.value = withTiming(true, timings.press);
        }
    };

    const animatedContainer = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(color.value, [0, 1, 2], [statusColors[0], statusColors[1], statusColors[2]]),
        height: interpolate(isShown.value, [true, false], [12, 0]),
    }));

    useEffect(() => {
        updateValue(networkStatus);
    }, [networkStatus]);

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
