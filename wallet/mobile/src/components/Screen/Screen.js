import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacings } from 'src/styles';


export const Screen = props => {
    const { children, style } = props;

    return (
        <View style={[styles.root, style]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        marginHorizontal: spacings.margin,
    }
});
