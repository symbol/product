import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { borders, colors, fonts, spacings, timings } from 'src/styles';

export const TextBox = (props) => {
    const { testID, contentRight, multiline, keyboardType, nativePlaceholder, title, value, errorMessage, onChange } = props;
    const isFocused = useSharedValue(false);
    const styleInput = multiline ? [styles.input, styles.inputMultiline] : [styles.input];
    const numberOfLines = multiline ? 5 : 1;
    const colorStrokeNormal = errorMessage ? colors.danger : colors.controlBaseStroke;
    const colorStrokeFocussed = errorMessage ? colors.danger : colors.controlBaseFocussedStroke;
    const animatedContainer = useAnimatedStyle(() => ({
        borderColor: interpolateColor(isFocused.value, [0, 1], [colorStrokeNormal, colorStrokeFocussed]),
    }));

    const handleFocusIn = () => {
        isFocused.value = withTiming(true, timings.press);
    };
    const handleFocusOut = () => {
        isFocused.value = withTiming(false, timings.press);
    };

    return (
        <Animated.View style={[styles.root, animatedContainer]}>
            <View style={styles.inputContainer}>
                <Text style={styles.title}>{title}</Text>
                <TextInput
                    testID={testID}
                    multiline={multiline}
                    numberOfLines={numberOfLines}
                    keyboardType={keyboardType}
                    nativePlaceholder={nativePlaceholder}
                    style={styleInput}
                    value={'' + value}
                    onFocus={handleFocusIn}
                    onBlur={handleFocusOut}
                    onChangeText={onChange}
                />
            </View>
            {contentRight}
            <Text style={styles.errorMessage}>{errorMessage}</Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    root: {
        position: 'relative',
        width: '100%',
        minHeight: spacings.controlHeight,
        paddingRight: spacings.margin,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: borders.borderRadius,
        borderWidth: borders.borderWidth,
        borderStyle: 'solid',
        backgroundColor: colors.controlBaseBg,
    },
    title: {
        ...fonts.placeholder,
        color: colors.controlBasePlaceholder,
    },
    inputContainer: {
        flex: 1,
        paddingHorizontal: spacings.margin,
    },
    input: {
        ...fonts.textBox,
        marginVertical: -fonts.textBox.fontSize,
        paddingLeft: 0,
        color: colors.controlBaseText,
    },
    inputMultiline: {
        textAlignVertical: 'top',
        marginVertical: 0,
    },
    errorMessage: {
        ...fonts.body,
        position: 'absolute',
        bottom: -fonts.body.fontSize - fonts.body.fontSize * 0.25,
        color: colors.danger,
    },
});
