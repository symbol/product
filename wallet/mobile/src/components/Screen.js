import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LoadingIndicator } from 'src/components';

export const Screen = props => {
    const { children, style, titleBar, bottomComponent, navigator, isLoading } = props;

    return (isLoading 
        ? <LoadingIndicator />
        : <View style={[styles.root, style]}>
            {titleBar}
            <View style={styles.content}>
                {children}
            </View>
            {!!bottomComponent && <View style={styles.bottom}>
                {bottomComponent}
            </View>}
            {navigator}
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        height: '100%',
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'space-between'
    },
    content: {
        flex: 1,
        marginBottom: 0
    },
});
