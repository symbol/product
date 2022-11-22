import React from 'react';
import {  StyleSheet } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { StyledText } from 'src/components';
import { colors } from 'src/styles';

export const ButtonPlain = props => {
    const { isDisabled, title, style, onPress } = props;

    const rootStyle = [isDisabled ? styles.disabled : null, style];

    const handlePress = () => {
        !isDisabled && onPress();
    };

    return (
        <TouchableOpacity disabled={isDisabled} style={rootStyle} onPress={handlePress}>
            <StyledText type="label" style={styles.text}>
                {title}
            </StyledText>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    disabled: {
        opacity: 0.3
    },
    text: {
        color: colors.primary
    },
});
