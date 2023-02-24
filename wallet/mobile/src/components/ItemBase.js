import { useIsFocused } from '@react-navigation/native';
import React, { useState } from 'react';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { borders, colors, spacings } from 'src/styles';
import { FormItem, TouchableNative } from 'src/components';

const MIN_SCALE = 1;
const MAX_SCALE = 1.2;
const ANIMATION_DURATION = 250;

export function ItemBase(props) {
    const { children, contentContainerStyle, style, borderColor, onPress } = props;
    const [isExpanded, setIsExpanded] = useState(false);
    const opacity = useSharedValue(0);
    const scale = useSharedValue(1);
    const animatedContainer = useAnimatedStyle(() => ({
        transform: [
            {
                scale: scale.value,
            },
        ],
        opacity: opacity.value,
    }));
    const stylesCardWithBorder = {
        ...styles.cardWithBorder,
        borderColor: borderColor,
    };
    const styleCard = [
        styles.card,
        borderColor ? stylesCardWithBorder : null,
        animatedContainer,
        contentContainerStyle,
    ];
    const styleRoot = [styles.root, style];
    // const layoutAnimationDelay = index < 15 ? index * 50 : 50;

    const handlePress = () => {
        if (onPress) {
            onPress();
            setIsExpanded(true);
        }
    };

    const isFocused = useIsFocused();

    useEffect(() => {
        if (isFocused && isExpanded) {
            scale.value = MAX_SCALE;
            scale.value = withTiming(MIN_SCALE, { duration: ANIMATION_DURATION });
            setIsExpanded(false);
        }
    }, [isFocused, isExpanded]);

    useEffect(() => {
        setTimeout(() => (opacity.value = withTiming(1)), 150);
    }, []);

    return (
        // <Animated.View entering={FadeIn.delay(layoutAnimationDelay)}>
        <FormItem type="list" style={styleRoot}>
            <TouchableNative onPress={handlePress}>
                <Animated.View style={styleCard}>{children}</Animated.View>
            </TouchableNative>
        </FormItem>
        // </Animated.View>
    );
}

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
        borderRadius: borders.borderRadius,
        padding: spacings.paddingSm + borders.borderWidth,
    },
    cardWithBorder: {
        borderWidth: borders.borderWidth,
        padding: spacings.paddingSm,
    },
    cardPlaceholder: {
        opacity: 0.2,
    },
});
