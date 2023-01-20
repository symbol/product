import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors, spacings } from 'src/styles';
import { TouchableNative } from 'src/components';

const SIZE = 56;

export const ButtonCircle = props => {
    const { source, style, onPress } = props;
    return (
        <View style={[styles.root, style]}>
            <TouchableNative style={styles.inner} color={'#fff'} onPress={onPress}>
                <Image source={source} style={styles.icon} />
            </TouchableNative> 
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        position: 'absolute',
        right: spacings.margin,
        bottom: spacings.margin * 2,
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        overflow: 'hidden',
        backgroundColor: colors.primary,
        elevation: 2
    },
    inner: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center'
    },
    icon: {
        width: 18,
        height: 18
    }
});
