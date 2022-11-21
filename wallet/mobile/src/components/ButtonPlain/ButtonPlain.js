import React from 'react';
import {  StyleSheet } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { StyledText } from 'src/components';
import { colors } from 'src/styles';

export const ButtonPlain = props => {
    const { title, style, onPress } = props;

    return (
        <TouchableOpacity style={style} onPress={onPress}>
            <StyledText type="label" style={styles.text}>
                {title}
            </StyledText>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    text: {
        color: colors.primary
    },
});
