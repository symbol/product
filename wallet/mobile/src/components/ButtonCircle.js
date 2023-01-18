import React from 'react';
import { Image, StyleSheet } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, spacings } from 'src/styles';
import { TouchableNative } from 'src/components';

const ANIMATION_DURATION = 250;
const SIZE = 64;

export const ButtonCircle = props => {
    const { source, style, onPress } = props;
    const isPressed = useSharedValue(0);

    const animatedContainer = useAnimatedStyle(() => {
        const interpolatedSize = interpolate(
            isPressed.value,
            [0, 1],
            [1, 0]
        );

        return {
            opacity: interpolate(
                isPressed.value,
                [0, 1],
                [1, 0]
            ),
            transform: [{
                scale: interpolatedSize
            }],
        }
    });

    const resetAnimation = () => {
        setTimeout(() => {
            isPressed.value = 0;
        }, ANIMATION_DURATION * 2);
    }
    const handlePress = () => {
        isPressed.value = withTiming(1, ANIMATION_DURATION);
        onPress();
        resetAnimation();
    };

    return (
        <Animated.View style={[styles.root, animatedContainer, style]}>
            <TouchableNative style={styles.inner} onPress={handlePress}>
                <Image source={source} style={styles.icon} />
            </TouchableNative> 
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    root: {
        position: 'absolute',
        right: spacings.margin,
        bottom: spacings.margin * 2,
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        overflow: 'hidden',
        backgroundColor: colors.primary
    },
    inner: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center'
    },
    icon: {
        width: 24,
        height: 24
    }
});
