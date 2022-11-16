import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { interpolate, interpolateColor, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { borders, colors, fonts, spacings, timings } from 'src/styles';


export const TextBox = props => {
    const { testID, buttons, title, value, onChange } = props;
    const isFocused = useSharedValue(false);
    const animatedContainer = useAnimatedStyle(() => ({
        borderColor: interpolateColor(
            isFocused.value,
            [0, 1],
            [colors.controlBaseStroke, colors.controlBaseFocussedStroke]
        ),
    }));

    const handleFocusIn = () => {
        isFocused.value = withTiming(true, timings.press);
    }
    const handleFocusOut = () => {
        isFocused.value = withTiming(false, timings.press);
    }

    return (
        <Animated.View style={[styles.root, animatedContainer]}>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.inputContainer}>
                <TextInput 
                    testID={testID}
                    style={styles.input} 
                    value={value}
                    onFocus={handleFocusIn}
                    onBlur={handleFocusOut}
                    onChangeText={onChange} 
                />
                {buttons}
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    root: {
        position: 'relative',
        width: '100%',
        height: spacings.controlHeight,
        justifyContent: 'center',
        borderRadius: borders.borderRadius,
        borderWidth: borders.borderWidth,
        borderStyle: 'solid',
        backgroundColor: colors.controlBaseBg
    },
    title: {
        ...fonts.placeholder,
        paddingHorizontal: spacings.margin,
        color: colors.controlBasePlaceholder,
    },
    inputContainer: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacings.margin,
    },
    input: {
        ...fonts.textBox, 
        marginVertical: -fonts.textBox.fontSize,
        flex: 1,
        paddingLeft: 0,
        color: colors.controlBaseTextAlt,
    }
});
