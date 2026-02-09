import React from 'react';

const insets = { top: 0, right: 0, bottom: 0, left: 0 };
const frame = { x: 0, y: 0, width: 320, height: 640 };

export const SafeAreaInsetsContext = React.createContext(insets);
export const SafeAreaFrameContext = React.createContext(frame);

export const SafeAreaProvider = ({ children }) => (
	<SafeAreaFrameContext.Provider value={frame}>
		<SafeAreaInsetsContext.Provider value={insets}>
			{children}
		</SafeAreaInsetsContext.Provider>
	</SafeAreaFrameContext.Provider>
);

export const SafeAreaView = ({ children }) => children;

export const useSafeAreaInsets = () => insets;

export const useSafeAreaFrame = () => frame;

export const initialWindowMetrics = {
	frame,
	insets
};
