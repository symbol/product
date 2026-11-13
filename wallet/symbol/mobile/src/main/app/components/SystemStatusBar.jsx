import React from 'react';
import { StatusBar as ReactStatusBar } from 'react-native';

/**
 * System status bar component.
 * The strip underneath the system notification bar.
 * @returns {React.ReactNode} System status bar component.
 */
export const SystemStatusBar = () => {
	return (
		<ReactStatusBar
			barStyle="light-content"
		/>
	);
};
