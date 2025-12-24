import { borders, colors, fonts, spacings, timings } from '@/app/styles';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// Helper to pick the first available color token from the theme
const pick = (...keys) => {
    for (const key of keys) {
        const v = colors?.[key];

        if (v != null) 
            return v;
    }
    return undefined;
};

// Sources for variant tokens: try variant-specific first, then fall back to base controlButton tokens
const VARIANT_SOURCES = {
    default: {
        bgNormal: ['controlButtonBg'],
        bgPressed: ['controlButtonPressedBg', 'controlButtonBg'],
        bgDisabled: ['controlButtonDisabledBg'],
        borderNormal: ['controlButtonStroke'],
        borderPressed: ['controlButtonPressedStroke', 'controlButtonStroke'],
        borderDisabled: ['controlButtonDisabledStroke'],
        textNormal: ['controlButtonText'],
        textPressed: ['controlButtonPressedText', 'controlButtonText'],
        textDisabled: ['controlButtonDisabledText']
    },
    danger: {
        bgNormal: ['dangerButtonBg', 'controlButtonBg'],
        bgPressed: ['dangerButtonPressedBg', 'controlButtonPressedBg', 'controlButtonBg'],
        borderNormal: ['dangerButtonStroke', 'controlButtonStroke'],
        borderPressed: ['dangerButtonPressedStroke', 'controlButtonPressedStroke', 'controlButtonStroke'],
        textNormal: ['dangerButtonText', 'controlButtonText'],
        textPressed: ['dangerButtonPressedText', 'errorPressedText', 'controlButtonPressedText', 'controlButtonText']
    },
    warning: {
        bgNormal: ['warningButtonBg', 'controlButtonBg'],
        bgPressed: ['warningButtonPressedBg', 'controlButtonPressedBg', 'controlButtonBg'],
        borderNormal: ['warningButtonStroke', 'controlButtonStroke'],
        borderPressed: ['warningButtonPressedStroke', 'controlButtonPressedStroke', 'controlButtonStroke'],
        textNormal: ['warningButtonText', 'controlButtonText'],
        textPressed: ['warningButtonPressedText', 'controlButtonPressedText', 'controlButtonText']
    }
};

const resolveVariantColors = (variant, isDisabled, isPrimary) => {
    const src = VARIANT_SOURCES[variant] ?? VARIANT_SOURCES.default;

    const normal = {
        bg: pick(...src.bgNormal),
        border: pick(...src.borderNormal),
        text: pick(...src.textNormal),

        bgDisabled: src.bgDisabled ? pick(...src.bgDisabled) : pick(...src.bgNormal),
        borderDisabled: src.borderDisabled ? pick(...src.borderDisabled) : pick(...src.borderNormal),
        textDisabled: src.textDisabled ? pick(...src.textDisabled) : pick(...src.textNormal)
    };
    const pressed = {
        bg: pick(...src.bgPressed) ?? normal.bg,
        border: pick(...src.borderPressed) ?? normal.border,
        text: pick(...src.textPressed) ?? normal.text
    };

    let colorScheme;
    if (isDisabled) {
        colorScheme = {
            bgNormal: normal.bgDisabled,
            bgPressed: normal.bgDisabled,
            borderNormal: normal.borderDisabled,
            borderPressed: normal.borderDisabled,
            textNormal: normal.textDisabled,
            textPressed: normal.textDisabled
        };
    } else {
        colorScheme = {
            bgNormal: normal.bg,
            bgPressed: pressed.bg,
            borderNormal: normal.border,
            borderPressed: pressed.border,
            textNormal: normal.text,
            textPressed: pressed.text
        };
    }

    if (isPrimary) {
        // Swap background and text colors for primary buttons
        colorScheme = {
            ...colorScheme,
            bgNormal: colorScheme.textNormal,
            borderNormal: colorScheme.textNormal,
            textNormal: colorScheme.bgNormal,
            borderPressed: colorScheme.bgPressed,
        };
    }

    return colorScheme;
};

export const Button = props => {
    const {
        isDisabled = false,
        isPrimary = false,
        style,
        testID,
        title,
        onPress,
        variant = 'default'
    } = props;

    const isPressed = useSharedValue(false);

    const {
        bgNormal,
        bgPressed,
        borderNormal,
        borderPressed,
        textNormal,
        textPressed
    } = resolveVariantColors(variant, isDisabled, isPrimary);

    const animatedContainer = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(isPressed.value, [0, 1], [bgNormal, bgPressed]),
        borderColor: interpolateColor(isPressed.value, [0, 1], [borderNormal, borderPressed])
    }));

    const animatedText = useAnimatedStyle(() => ({
        color: interpolateColor(isPressed.value, [0, 1], [textNormal, textPressed])
    }));

    const handlePressIn = e => {
        e.stopPropagation?.();
        isPressed.value = withTiming(true, timings.press);
    };
    const handlePressOut = e => {
        e.stopPropagation?.();
        isPressed.value = withTiming(false, timings.press);
    };
    const handlePress = e => {
        e.stopPropagation?.();
        !isDisabled && onPress && onPress();
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
        borderStyle: 'solid'
    },
    disabled: {
        opacity: 0.3
    }
});
