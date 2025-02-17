import React from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import { StyledText } from '@/app/components';
import { $t } from '@/app/localization';
import { colors, fonts } from '@/app/styles';

export const ButtonClose = (props) => {
    const { type, style, onPress } = props;
    const textMap = {
        cancel: $t('button_cancel'),
        close: $t('button_close'),
    };
    const text = textMap[type];

    return (
        <TouchableOpacity style={[styles.root, style]} hitSlop={5} onPress={onPress}>
            {text && (
                <StyledText type="label" style={styles.text}>
                    {text}
                </StyledText>
            )}
            <Image source={require('@/app/assets/images/icon-close.png')} style={styles.icon} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    root: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: fonts.label.fontSize,
    },
    text: {
        color: colors.textBody,
    },
    icon: {
        width: 20,
        height: 20,
    },
});
