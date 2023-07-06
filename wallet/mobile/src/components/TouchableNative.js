import Color from 'color';
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { TouchableHighlight, TouchableNativeFeedback, TouchableOpacity } from 'react-native-gesture-handler';

export const TouchableNative = (props) => {
    const { color, children, style, containerStyle, ...rest } = props;
    const getAndroidColor = () => color && TouchableNativeFeedback.Ripple(color);
    const getIosColor = () => useMemo(() => color && Color(color).darken(0.2).hex(), [color]);

    return Platform.OS === 'android' ? (
        <TouchableNativeFeedback background={getAndroidColor()} style={style} containerStyle={containerStyle} {...rest}>
            {children}
        </TouchableNativeFeedback>
    ) : (
        <TouchableHighlight underlayColor={getIosColor()} style={containerStyle} {...rest}>
            <View style={style}>{children}</View>
        </TouchableHighlight>
    );
};
