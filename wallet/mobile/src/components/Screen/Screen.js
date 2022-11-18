import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacings } from 'src/styles';


export const Screen = props => {
    const { children, style, bottomComponent } = props;

    return (
        <View style={[styles.root, style]}>
            <View style={styles.fill}>
                {children}
            </View>
            {!!bottomComponent && <View style={styles.bottom}>
                {bottomComponent}
            </View>}
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        marginHorizontal: spacings.margin,
        flexDirection: 'column',
        justifyContent: 'space-between'
    },
    fill: {
        flex: 1
    },
    bottom: {
        paddingVertical: spacings.padding
    }
});
