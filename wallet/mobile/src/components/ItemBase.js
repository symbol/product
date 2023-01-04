import React from 'react';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { borders, colors, spacings } from 'src/styles';
import { FormItem } from './FormItem';

export function ItemBase(props) {
    const { children, isLayoutAnimationEnabled, style } = props;

    const opacity = useSharedValue(0);
    const animatedContainer = useAnimatedStyle(() => ({
        opacity: opacity.value
    }));
    const styleRoot = [styles.root, style, isLayoutAnimationEnabled ? animatedContainer : null];

    useEffect(() => {
        if (isLayoutAnimationEnabled) {
            setTimeout(() => opacity.value = withTiming(1), 150);
        }
    }, [isLayoutAnimationEnabled])

    return (
        <FormItem type="list">
            {/* TODO: uncomment when issue is fixed https://github.com/react-navigation/react-navigation/issues/10531 */}
            {/* <Animated.View entering={FadeInUp.duration(500)}> */}
            {/* <Animated.View entering={FadeIn.duration(1000)}> */}
                <Animated.View style={styleRoot}>
                    {children}
                </Animated.View>
            {/* </Animated.View> */}
            {/* </Animated.View> */}
        </FormItem>
    );
};

export const ItemPlaceholder = () => (
    <FormItem type="list">
        <View style={[styles.root, styles.rootPlaceholder]} />
    </FormItem>
);

const styles = StyleSheet.create({
    root: {
        width: '100%',
        minHeight: 75,
        backgroundColor: colors.bgCard,
        borderColor: colors.bgCard,
        borderWidth: borders.borderWidth,
        borderRadius: borders.borderRadius,
        padding: spacings.paddingSm
    },
    rootPlaceholder: {
        opacity: 0.2
    },
});
