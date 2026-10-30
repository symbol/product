import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import FlashMessage from 'react-native-flash-message';

const flashMessageStyle = { 
	backgroundColor: Colors.Components.popupMessage.background, 
	borderBottomColor: Colors.Components.popupMessage.border, 
	borderBottomWidth: Sizes.Semantic.borderWidth.s 
};
const flashMessageTextStyle = { 
	color: Colors.Components.popupMessage.text 
};

/**
 * Popup message component.
 * @returns {React.ReactNode} Popup message component.
 */
export const PopupMessage = () => {
	return (
		<FlashMessage
			statusBarHeight={8}
			animationDuration={200}
			titleStyle={flashMessageTextStyle}
			style={flashMessageStyle}
			position="top"
		/>
	);
};
