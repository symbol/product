import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { StyledText } from 'src/components';
import { colors, fonts } from 'src/styles';

export const ButtonClose = props => {
    const { type, style, onPress } = props;
    let text = null;

    if (type === 'cancel') {
        // notranslate
        text = 'Cancel';
    }
    else if (type === 'close') {
        // notranslate
        text = 'Close';
    }

    return (
        <TouchableOpacity style={[styles.root, style]} hitSlop={5} onPress={onPress}>
            {text && <StyledText type="label" style={styles.text}>
                {text}
            </StyledText>}
            <Image source={require('src/assets/images/icon-close.png')} style={styles.icon} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    root: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: fonts.label.fontSize
    },
    text: {
        color: colors.textBody
    },
    icon: {
        width: 20,
        height: 20,
    }
});
