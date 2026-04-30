import { Colors } from '@/app/styles';
import React from 'react';
import { StatusBar as ReactStatusBar } from 'react-native';

/**
 * System status bar component. 
 * The strip underneath the system notification bar.
 * Colored to match the app theme.
 * @returns {React.ReactNode} System status bar component.
 */
export const SystemStatusBar = () => {
	return (
		<ReactStatusBar
			backgroundColor={Colors.Components.statusbar.background}
			barStyle="light-content"
		/>
	);
};
