import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { copyToClipboard } from 'src/utils';

export const ButtonCopy = props => {
    const { content, style, size } = props;
    const styleIcon = size === 'sm' ? styles.icon : styles.iconSm;

    handlePress = () => {
        try {
            copyToClipboard(content);
            // notranslate
            showMessage({message: 'Copied.', type: 'success'});
        }
        catch(error) {
            showMessage({message: error.message, type: 'danger'});
        }
    }

    return (
        <TouchableOpacity style={style} onPress={handlePress} hitSlop={10}>
            <Image source={require('src/assets/images/icon-copy.png')} style={styleIcon} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    icon: {
        width: 24,
        height: 24,
    },
    iconSm: {
        width: 16,
        height: 16,
    }
});
