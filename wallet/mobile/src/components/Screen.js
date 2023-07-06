import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LoadingIndicator } from 'src/components';
import { colors, spacings } from 'src/styles';

export const Screen = (props) => {
    const { children, style, titleBar, bottomComponent, bottomComponent2, navigator, isLoading } = props;

    return isLoading ? (
        <LoadingIndicator fill />
    ) : (
        <View style={[styles.root, style]}>
            {titleBar}
            <View style={styles.content}>{children}</View>
            {bottomComponent2}
            {!!bottomComponent && <View style={styles.bottom}>{bottomComponent}</View>}
            {navigator}
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        height: '100%',
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: colors.bgGray,
    },
    content: {
        flex: 1,
        marginBottom: 0,
    },
    bottom: {
        marginBottom: spacings.margin,
    },
});
