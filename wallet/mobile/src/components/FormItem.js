import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacings } from 'src/styles';

export const FormItem = (props) => {
    const { children, style, type, clear, fill } = props;
    const clearMap = {
        top: styles.clearTop,
        bottom: styles.clearBottom,
        vertical: styles.clearVertical,
        horizontal: styles.clearHorizontal,
    };
    const clearStyle = clearMap[clear];
    const typeMap = {
        list: styles.listItem,
        group: styles.group,
    };
    const typeStyle = typeMap[type];
    const fillStyle = fill ? styles.fill : null;

    return <View style={[styles.root, typeStyle, clearStyle, fillStyle, style]}>{children}</View>;
};

const styles = StyleSheet.create({
    root: {
        marginVertical: spacings.margin,
        marginHorizontal: spacings.margin,
    },
    listItem: {
        marginHorizontal: 0,
        marginVertical: 0,
        marginBottom: spacings.margin,
    },
    group: {
        marginVertical: spacings.marginLg,
        marginHorizontal: spacings.margin,
    },
    clearTop: {
        marginTop: 0,
    },
    clearBottom: {
        marginBottom: 0,
    },
    clearVertical: {
        marginVertical: 0,
    },
    clearHorizontal: {
        marginHorizontal: 0,
    },
    fill: {
        flex: 1,
    },
});
