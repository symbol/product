import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacings } from 'src/styles';

export const WalletCreationAnimation = (props) => {
    const { steps, currentStep } = props;
    const [timer, setTimer] = useState(null);
    const [index, setIndex] = useState(0);

    const currentStepText = steps[currentStep - 1];
    const currentLine = currentStepText.slice(0, index);
    const typedLines = steps.slice(0, currentStep - 1);

    useEffect(() => {
        const textLength = currentStepText.length;
        const duration = 10;
        setIndex(0);
        clearInterval(timer);

        const newTimer = setInterval(() => {
            setIndex((index) => (index < textLength ? index + 1 : index));
        }, duration);
        setTimer(newTimer);
    }, [currentStep]);

    return (
        <View style={styles.root}>
            <Image source={require('src/assets/images/logo-symbol-ascii-small.png')} style={styles.logo} />
            <View style={styles.terminal}>
                {typedLines.map((line, index) => (
                    <Text style={styles.line} key={'la' + index}>
                        <Text style={styles.titleText}>Symbol Wallet: </Text>
                        <Text style={styles.loadingText}>{line}</Text>
                    </Text>
                ))}
                <Text style={styles.line}>
                    <Text style={styles.titleText}>Symbol Wallet: </Text>
                    <Text style={styles.loadingText}>{currentLine}</Text>
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: colors.bgForm,
        padding: spacings.padding,
    },
    logo: {
        width: '100%',
        margin: 'auto',
        resizeMode: 'contain',
    },
    terminal: {
        width: '100%',
        minHeight: '30%',
    },
    line: {
        width: '100%',
    },
    titleText: {
        ...fonts.label,
        color: colors.primary,
    },
    loadingText: {
        ...fonts.label,
        color: colors.textBody,
    },
});
