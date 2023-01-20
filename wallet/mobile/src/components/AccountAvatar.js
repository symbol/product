import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { getColorFromHash,} from 'src/utils';

export const AccountAvatar = (props) => {
    const { address, size, style } = props;
    const addressSecondChar = address[1].toUpperCase();
    const rootStyle = [styles.root, style];
    const imageStyle = [styles.image];
    let imageSrc;
    
    switch(size) {
        default:
        case 'sm': rootStyle.push(styles.rootSm); break;
        case 'md': rootStyle.push(styles.rootMd); break;
        case 'lg': rootStyle.push(styles.rootLg); break;
    }

    switch(addressSecondChar) {
        default:
        case 'A': imageSrc = require('src/assets/images/avatars/avatar-1.png'); break;
        case 'B': imageSrc = require('src/assets/images/avatars/avatar-2.png'); break;
        case 'C': imageSrc = require('src/assets/images/avatars/avatar-3.png'); break;
        case 'D': imageSrc = require('src/assets/images/avatars/avatar-4.png'); break;
    }

    imageStyle.push({
        backgroundColor: getColorFromHash(address)
    });

    return (
        <View style={rootStyle}>
            <Image source={imageSrc} style={imageStyle} />
        </View>
    )
}

const styles = StyleSheet.create({
    root: {
        overflow: 'hidden'
    },
    rootSm: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    rootMd: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    rootLg: {
        width: 128,
        height: 128,
        borderRadius: 64,
    },
    image: {
        width: '100%',
        height: '100%',
    }
});
