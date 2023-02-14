import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { connect } from 'src/store';
import { colors, fonts, timings } from 'src/styles';
import Animated, {
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { $t } from 'src/localization';

export const ConnectionStatus = connect((state) => ({
    status: state.network.status,
}))(function ConnectionStatus(props) {
    const { status } = props;
    const statusColors = [colors.info, colors.warning, colors.danger];
    const isShown = useSharedValue(true);
    const color = useDerivedValue(() => {
        const value = status === 'failed-custom' ? 2 : status === 'connected' ? 0 : 1;
        return withTiming(value);
    });
    let statusText = $t('c_connectionStatus_connecting');

    switch (status) {
        case 'offline':
            statusText = $t('c_connectionStatus_offline');
            isShown.value = withTiming(true, timings.press);
            break;
        case 'failed-custom':
            statusText = $t('c_connectionStatus_nodeDown');
            isShown.value = withTiming(true, timings.press);
            break;
        case 'connected':
            statusText = $t('c_connectionStatus_connected');
            isShown.value = withTiming(false, timings.press);
            break;
        default:
            isShown.value = withTiming(true, timings.press);
    }

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
