import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import React from 'react';
import { TouchableHighlight , TouchableNativeFeedback, View } from 'react-native';

/**
 * TouchableNative component. A cross-platform touchable wrapper that provides native touch feedback,
 * using ripple effects on Android and highlight colors on iOS.
 *
 * @param {object} props - Component props
 * @param {string} [props.color] - Background color.
 * @param {string} [props.colorPressed] - Color when pressed, defaults to color if not provided.
 * Used for the ripple effect on Android or highlight on iOS.
 * @param {React.ReactNode} props.children - Child components to render inside the touchable.
 * @param {object} [props.style] - Additional styles for the inner View element.
 * @param {object} [props.containerStyle] - Additional styles for the touchable container.
 *
 * @returns {React.ReactNode} TouchableNative component
 */
export const TouchableNative = props => {
	const { color, colorPressed, children, style, containerStyle, ...rest } = props;
	const getAndroidColor = () => color && TouchableNativeFeedback.Ripple(colorPressed ?? color);
	const getIosColor = () => colorPressed ?? color;

	return PlatformUtils.getOS() === 'android' ? (
		<TouchableNativeFeedback background={getAndroidColor()} style={containerStyle} {...rest}>
			<View style={[style, containerStyle]}>{children}</View>
		</TouchableNativeFeedback>
	) : (
		<TouchableHighlight underlayColor={getIosColor()} style={containerStyle} pointerEvents="box-none" {...rest}>
			<View style={style}>{children}</View>
		</TouchableHighlight>
	);
};
