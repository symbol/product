import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors, fonts } from 'src/styles';

export const StyledText = props => {
    const { children, style, type } = props;
    const typeStyleMap = {
        'title-large': styles.titleLarge,
        'title': styles.title,
        'subtitle': styles.subtitle,
        'body': styles.body,
        'tab': styles.tab,
        'label': styles.label,
        'body-bold': styles.bodyBold,
        'link': styles.link,
    }
    const customStyle = typeStyleMap[type];

    return (
        <Text style={[styles.root, customStyle, style]}>
            {children}
        </Text>
    );
};

const styles = StyleSheet.create({
    root: {
        color: colors.textBody
    },
    titleLarge: {
        ...fonts.titleLarge
    },
    title: {
        ...fonts.title
    },
    subtitle: {
        ...fonts.subtitle
    },
    body: {
        ...fonts.body
    },
    bodyBold: {
        ...fonts.bodyBold
    },
    label: {
        ...fonts.label
    },
    tab: {
        ...fonts.tab
    },
    link: {
        ...fonts.body,
        textDecorationStyle: 'solid',
        color: colors.textLink
    },
});
