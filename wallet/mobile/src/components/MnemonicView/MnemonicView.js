import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { borders, colors, fonts, spacings } from 'src/styles';

export const MnemonicView = props => {
    const { isShown, mnemonic, onShowPress} = props;
    const placeholder = Array(mnemonic.length).join('*');
    const styleMnemonicText = isShown ? [styles.textMnemonic] : [styles.textMnemonic, styles.hidden];
    const mnemonicText = isShown ? mnemonic : placeholder;
    
    return (
        <View style={styles.root}>
            <Text style={styleMnemonicText}>
                {mnemonicText}
            </Text>
            {!isShown && <TouchableOpacity onPress={onShowPress} style={styles.button}>
                <Text style={styles.textButton}>
                    {/* notranslate  */}
                    Show Mnemonic
                </Text>
            </TouchableOpacity>}
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        position: 'relative',
        width: '100%',
        backgroundColor: colors.bgForm,
        borderRadius: borders.borderRadiusForm,
    },
    textMnemonic: {
        ...fonts.label,
        marginTop: spacings.margin,
        color: colors.textForm,
        textAlign: 'center',
        padding: spacings.padding
    },
    textButton: {
        ...fonts.button,
        color: colors.controlButtonText,
        textAlign: 'center'
    },
    button: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    hidden: {
        opacity: 0.1
    },
});
