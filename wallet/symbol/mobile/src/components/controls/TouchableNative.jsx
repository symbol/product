import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import React from 'react';
import { TouchableHighlight , TouchableNativeFeedback, View } from 'react-native';

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
