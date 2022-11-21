import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { copyToClipboard } from 'src/utils';

export const ButtonCopy = props => {
    const { content, style } = props;

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
        <TouchableOpacity style={style} onPress={handlePress}>
            <Image source={require('src/assets/images/icon-copy.png')} style={styles.icon} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    icon: {
        width: 24,
        height: 24,
    }
});
