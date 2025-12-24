import Color from 'color';
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { TouchableHighlight, TouchableNativeFeedback } from 'react-native';

export const TouchableNative = props => {
	const { color, children, style, containerStyle, ...rest } = props;
	const getAndroidColor = () => color && TouchableNativeFeedback.Ripple(color);
	const getIosColor = () => useMemo(() => color && Color(color).darken(0.2).hex(), [color]);

	return Platform.OS === 'android' ? (
		<TouchableNativeFeedback background={getAndroidColor()} style={containerStyle} {...rest}>
			<View style={[style, containerStyle]}>{children}</View>
		</TouchableNativeFeedback>
	) : (
		<TouchableHighlight underlayColor={getIosColor()} style={containerStyle} pointerEvents="box-none" {...rest}>
			<View style={style}>{children}</View>
		</TouchableHighlight>
	);
};
