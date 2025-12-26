import { $t } from '@/app/localization';
import { Colors, Typography } from '@/app/styles';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
	interpolate,
	interpolateColor,
	useAnimatedStyle,
	useDerivedValue,
	withTiming
} from 'react-native-reanimated';
import { constants } from 'wallet-common-core';
const { NetworkConnectionStatus } = constants;

/**
 * Network connection status bar component
 * 
 * @param {object} props - Component props
 * @param {string} props.networkStatus - Current network connection status
 * 
 * @returns {React.ReactNode} Network connection status bar component
 */
export const NetworkConnectionStatusBar = ({ networkStatus }) => {
	const statusTextMap = {
		[NetworkConnectionStatus.INITIAL]: $t('c_connectionStatus_connecting'),
		[NetworkConnectionStatus.CONNECTING]: $t('c_connectionStatus_connecting'),
		[NetworkConnectionStatus.CONNECTED]: $t('c_connectionStatus_connected'),
		[NetworkConnectionStatus.NO_INTERNET]: $t('c_connectionStatus_offline'),
		[NetworkConnectionStatus.FAILED_CUSTOM_NODE]: $t('c_connectionStatus_nodeDown')
	};
	const statusText = statusTextMap[networkStatus];
	const statusColors = [
		Colors.Components.networkConnectionStatus.connected.background,
		Colors.Components.networkConnectionStatus.connecting.background,
		Colors.Components.networkConnectionStatus.disconnected.background
	];
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
		height: interpolate(isShown.value, [true, false], [12, 0])
	}));

	return (
		<Animated.View style={[styles.root, animatedContainer]}>
			<Text style={styles.text}>{statusText}</Text>
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	root: {
		width: '100%',
		justifyContent: 'center',
		alignItems: 'center'
	},
	text: {
		...Typography.Semantic.bodyBold.s,
		color: Colors.Components.networkConnectionStatus.default.text
	}
});
