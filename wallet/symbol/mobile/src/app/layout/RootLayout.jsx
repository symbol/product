import { NavigationMenu, NetworkConnectionStatusBar, PopupMessage, SystemStatusBar } from '../components';
import { RouteName } from '@/app/router/config';
import { Colors } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const SCREENS_THAT_SHOW_NAVIGATION_MENU = [
	RouteName.Home,
	RouteName.History
];

/**
 * Root app layout component
 *
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @param {boolean} props.isNetworkStatusShown - Show network status bar if true
 * @param {string} props.networkStatus - Current network connection status
 * @param {string} props.currentRouteName - Current active route name
 * 
 * @returns {React.ReactNode} Root layout component
 */
export const RootLayout = ({ 
	children, isNetworkStatusShown, networkStatus, currentRouteName }) => {
	const isNavigationMenuShown = SCREENS_THAT_SHOW_NAVIGATION_MENU.includes(currentRouteName);
	
	return (
		<>
			<GestureHandlerRootView style={styles.root}>
				<SafeAreaProvider>
					<SafeAreaView style={styles.safeAreaOuter}>
						<View style={styles.safeAreaInner}>
							<SystemStatusBar />
							{isNetworkStatusShown && (
								<NetworkConnectionStatusBar networkStatus={networkStatus} />
							)}
							{children}
							{isNavigationMenuShown && (
								<NavigationMenu currentRouteName={currentRouteName} />
							)}
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
