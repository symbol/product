import { useIsFocused } from '@react-navigation/native';
import React, { useState } from 'react';
import { useEffect } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { borders, colors, spacings } from 'src/styles';
import { FormItem, TouchableNative } from 'src/components';

const MIN_SCALE = 1;
const MAX_SCALE = 1.2;
const ANIMATION_DURATION = 250;

export function ItemBase(props) {
    const { children, isLayoutAnimationEnabled, style, onPress } = props;
    const [isExpanded, setIsExpanded] = useState(false);
    const opacity = useSharedValue(0);
    const scale = useSharedValue(1);
    const animatedContainer = useAnimatedStyle(() => ({
        transform: [{
            scale: scale.value
        }],
        opacity: opacity.value,
    }));
    const styleCard = [styles.card, style, isLayoutAnimationEnabled ? animatedContainer : null];
    const styleRoot = [styles.root];

    const handlePress = () => {
        if (onPress) {
            onPress();
            setIsExpanded(true);
        }
    }

    const isFocused = useIsFocused();

    useEffect(() => {
        if (isFocused && isExpanded) {
            scale.value = MAX_SCALE;
            scale.value = withTiming(MIN_SCALE, { duration: ANIMATION_DURATION });
            setIsExpanded(false);
        }
    }, [isFocused, isExpanded]);

    useEffect(() => {
        if (isLayoutAnimationEnabled) {
            setTimeout(() => opacity.value = withTiming(1), 150);
        }
    }, [isLayoutAnimationEnabled])

    return (
        <FormItem type="list" style={styleRoot}>
            <TouchableNative onPress={handlePress}>
                <Animated.View style={styleCard}>
                    {children}
                </Animated.View>
            </TouchableNative>
        </FormItem>
    );
};

export const ItemPlaceholder = () => (
    <FormItem type="list">
        <View style={[styles.card, styles.cardPlaceholder]} />
    </FormItem>
);

const styles = StyleSheet.create({
    root: {
        marginHorizontal: spacings.margin,
        position: 'relative',
    },
    card: {
        width: '100%',
        minHeight: 75,
        backgroundColor: colors.bgCard,
        borderColor: colors.bgCard,
        borderWidth: borders.borderWidth,
        borderRadius: borders.borderRadius,
        padding: spacings.paddingSm
    },
    cardPlaceholder: {
        opacity: 0.2
    },
});
