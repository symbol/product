import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LoadingIndicator } from 'src/components';
import { spacings } from 'src/styles';

export const Screen = props => {
    const { children, style, titleBar, bottomComponent, navigator, isLoading } = props;

    return (isLoading 
        ? <LoadingIndicator fill/>
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
    bottom: {
        marginBottom: spacings.margin
    }
});
