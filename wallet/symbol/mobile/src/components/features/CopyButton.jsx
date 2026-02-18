import { Icon } from '@/app/components/visual';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { showMessage } from '@/app/utils';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';

/**
 * CopyButton component. A button that copies provided content to the clipboard and displays a confirmation message.
 *
 * @param {object} props - Component props.
 * @param {string} props.content - Content to copy to clipboard.
 * @param {'s' | 'm'} [props.size='m'] - Button size.
 * @param {object} [props.style] - Additional styles for the button container.
 * 
 * @returns {React.ReactNode} Copy button component
 */
export const CopyButton = ({ content, size = 'm', style }) => {
	const iconSizeMap = {
		s: 'xs',
		m: 's'
	};
	const iconSize = iconSizeMap[size];

	const handlePress = () => {
		try {
			PlatformUtils.copyToClipboard(content);
			showMessage({ message: content, type: 'info' });
		} catch (error) {
			showMessage({ message: error.message, type: 'danger' });
		}
	};
	const stopPropagation = e => {
		e?.stopPropagation?.();
	};

	return (
		<View style={style} onTouchEnd={stopPropagation}>
			<TouchableOpacity accessibilityRole="button" onPress={handlePress} hitSlop={10}>
				<Icon name="copy" size={iconSize} />
			</TouchableOpacity>
		</View>
	);
};
