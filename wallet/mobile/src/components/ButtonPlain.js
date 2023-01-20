import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { StyledText } from 'src/components';
import { colors, spacings } from 'src/styles';

export const ButtonPlain = props => {
    const { isDisabled, title, style, icon, isCentered, onPress } = props;

    const rootStyle = [
        styles.root,
        isDisabled ? styles.disabled : null,
        isCentered ? styles.centered : null,
        style
    ];

    const handlePress = () => {
        !isDisabled && onPress();
    };

    return (
        <TouchableOpacity disabled={isDisabled} hitSlop={5} style={rootStyle} onPress={handlePress}>
            {icon && <Image style={styles.icon} source={icon} />}
            <StyledText type="label" style={styles.text}>
                {title}
            </StyledText>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    root: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    icon: {
        width: 18,
        height: 18,
        marginRight: spacings.paddingSm
    },
    disabled: {
        opacity: 0.3
    },
    centered: {
        flexDirection: 'row',
        justifyContent: 'center'
    },
    text: {
        color: colors.primary
    },
});
