import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { borders, colors, fonts, timings } from 'src/styles';

export const Checkbox = (props) => {
    const { style, testID, title, value, onChange } = props;
    const isPressed = useSharedValue(false);

    const colorBorderNormal = colors.controlBaseStroke;
    const colorBorderPressed = colors.controlBaseFocussedStroke;
    const colorTextNormal = colors.textBody;
    const colorTextPressed = colors.secondary;

    const animatedContainer = useAnimatedStyle(() => ({
        borderColor: interpolateColor(isPressed.value, [0, 1], [colorBorderNormal, colorBorderPressed]),
    }));
    const animatedText = useAnimatedStyle(() => ({
        color: interpolateColor(isPressed.value, [0, 1], [colorTextNormal, colorTextPressed]),
    }));
    const animatedCheck = useAnimatedStyle(() => ({
        transform: [{ scale: interpolate(isPressed.value, [0, 1], [1, 0]) }],
    }));
    const stylesCheck = [styles.icon, animatedCheck, !value ? styles.hidden : null];

    const handlePressIn = () => {
        isPressed.value = withTiming(true, timings.press);
    };
    const handlePressOut = () => {
        isPressed.value = withTiming(false, timings.press);
    };
    const handlePress = () => {
        onChange(!value);
    };

    return (
        <Pressable style={[styles.root, style]} hitSlop={5} onPress={handlePress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
            <Animated.View style={[styles.container, animatedContainer]}>
                <Animated.Image source={require('src/assets/images/icon-check.png')} style={stylesCheck} />
            </Animated.View>
            <Animated.Text style={[fonts.label, animatedText]} testID={testID}>
                {title}
            </Animated.Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    root: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
    },
    container: {
        width: 22,
        height: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: borders.borderRadiusControl,
        borderWidth: 1,
        borderStyle: 'solid',
        marginRight: 8,
    },
    icon: {
        width: 18,
        height: 18,
    },
    hidden: {
        opacity: 0,
    },
});
