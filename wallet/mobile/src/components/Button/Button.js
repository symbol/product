import React from 'react';
import {  Pressable, StyleSheet } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { borders, colors, fonts, spacings, timings } from 'src/styles';


export const Button = props => {
    const { isDisabled, style, testID, title, onPress } = props;
    const isPressed = useSharedValue(false);
    
    const colorBgNormal = isDisabled ? colors.controlButtonBg : colors.controlButtonBg;
    const colorBgPressed = isDisabled ? colors.controlButtonBg : colors.controlButtonPressedBg;
    const colorBorderNormal = isDisabled ? colors.controlButtonDisabledStroke : colors.controlButtonStroke;
    const colorBorderPressed = isDisabled ? colors.controlButtonDisabledStroke : colors.controlButtonPressedStroke;
    const colorTextNormal = isDisabled ? colors.controlButtonDisabledText : colors.controlButtonText;
    const colorTextPressed = isDisabled ? colors.controlButtonDisabledText : colors.controlButtonPressedText;

    const animatedContainer = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            isPressed.value,
            [0, 1],
            [colorBgNormal, colorBgPressed]
        ),
        borderColor: interpolateColor(
            isPressed.value,
            [0, 1],
            [colorBorderNormal, colorBorderPressed]
        ),
    }));
    const animatedText = useAnimatedStyle(() => ({
        color: interpolateColor(
            isPressed.value,
            [0, 1],
            [colorTextNormal, colorTextPressed]
        ),
    }));

    const handlePressIn = () => {
        isPressed.value = withTiming(true, timings.press);
    };
    const handlePressOut = () => {
        isPressed.value = withTiming(false, timings.press);
    };
    const handlePress = () => {
        !isDisabled && onPress();
    };

    return (
        <Pressable onPress={handlePress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
            <Animated.View style={[styles.root, animatedContainer, style]}>
                <Animated.Text style={[fonts.button, animatedText]} testID={testID}>
                   {title}
                </Animated.Text>
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    root: {
        width: '100%',
        height: spacings.controlHeight,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: borders.borderRadius,
        borderWidth: borders.borderWidth,
        borderStyle: 'solid',
    },
});
