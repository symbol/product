import React from 'react';
import { TouchableHighlight, TouchableNativeFeedback } from 'react-native-gesture-handler';

export const TouchableNative = props => {
    const { color, children, ...rest} = props;
    const getAndroidColor = () => color && TouchableNativeFeedback.Ripple(color);

    return (
        Platform.OS === 'android'
        ? <TouchableNativeFeedback 
            background={getAndroidColor()}
            {...rest}
        >
            {children}
        </TouchableNativeFeedback>
        : <TouchableHighlight 
            underlayColor={color}
            {...rest}
        >
            {children}
        </TouchableHighlight>
    )
};
