import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import React from 'react';
import { TouchableHighlight , TouchableNativeFeedback, View } from 'react-native';

/**
 * TouchableNative component. A cross-platform touchable wrapper that provides native touch feedback,
 * using ripple effects on Android and highlight colors on iOS.
 * @param {object} props - Component props.
 * @param {string} [props.color] - Background color.
 * @param {string} [props.colorPressed] - Color when pressed, defaults to color if not provided.
 * Used for the ripple effect on Android or highlight on iOS.
 * @param {React.ReactNode} props.children - Child components to render inside the touchable.
 * @param {object} [props.style] - Additional styles for the inner View element.
 * @param {object} [props.containerStyle] - Additional styles for the touchable container.
 * @param {boolean} [props.isDisabled] - If true, disables touch interactions.
 * @returns {React.ReactNode} TouchableNative component.
 */
export const TouchableNative = props => {
	const { color, colorPressed, children, style, containerStyle, isDisabled, ...rest } = props;
	const getAndroidColor = () => TouchableNativeFeedback.Ripple(colorPressed ?? color, false);
	const getIosColor = () => colorPressed ?? '#0002';
	const containerStyles = [{ backgroundColor: color }, containerStyle, styles.androidContainer];

	return PlatformUtils.getOS() === 'android' ? (
		<TouchableNativeFeedback
			background={getAndroidColor()}
			disabled={isDisabled}
			useForeground
			{...rest}
		>
			<View style={containerStyles}>
				<View style={style}>{children}</View>
			</View>
		</TouchableNativeFeedback>
	) : (
		<TouchableHighlight
			underlayColor={getIosColor()}
			style={[{ backgroundColor: color }, containerStyle]}
			disabled={isDisabled}
			pointerEvents="box-none"
			{...rest}
		>
			<View style={style}>{children}</View>
		</TouchableHighlight>
	);
};

const styles = {
	androidContainer: {
		overflow: 'hidden'
	}
};
