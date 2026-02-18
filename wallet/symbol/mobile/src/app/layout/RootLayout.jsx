import { NetworkConnectionStatusBar, PopupMessage, SystemStatusBar } from '../components';
import { Colors } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

/**
 * Root app layout component
 *
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @param {boolean} props.isNetworkStatusShown - Show network status bar if true
 * @param {string} props.networkStatus - Current network connection status
 * 
 * @returns {React.ReactNode} Root layout component
 */
export const RootLayout = ({ children, isNetworkStatusShown, networkStatus }) => {
	return (
		<>
			<GestureHandlerRootView style={styles.root}>
				<SafeAreaProvider>
					<SafeAreaView style={styles.safeAreaOuter}>
						<View style={styles.safeAreaInner}>
							<SystemStatusBar />
							{isNetworkStatusShown && <NetworkConnectionStatusBar networkStatus={networkStatus} />}
							{children}
							<PopupMessage />
						</View>
					</SafeAreaView>
				</SafeAreaProvider>
			</GestureHandlerRootView>
		</>
	);
};


const styles = StyleSheet.create({
	root: {
		flex: 1
	},
	safeAreaOuter: {
		flex: 1,
		backgroundColor: Colors.Components.statusbar.background
	},
	safeAreaInner: {
		position: 'relative',
		flex: 1,
		backgroundColor: Colors.Components.main.background
	}
});
