import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacings } from 'src/styles';


export const FormItem = props => {
    const { children, style, type } = props;
    const isListItem = type === 'list';

    return (
        <View style={[styles.root, isListItem ? styles.listItem : null, style]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        marginVertical: spacings.margin,
    },
    listItem: {
        marginVertical: null,
        marginBottom: spacings.margin,
    }
});
