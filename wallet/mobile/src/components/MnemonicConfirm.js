import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { borders, colors, fonts, spacings } from 'src/styles';
import { ButtonPlain, MnemonicView } from 'src/components';

export const MnemonicConfirm = (props) => {
    const { mnemonic, onChange } = props;
    const [enteredWords, setEnteredWords] = useState([]);
    const [remainedWords, setRemainedWords] = useState([]);
    const enteredMnemonic = enteredWords.join(' ');
    const isBackspaceButtonShown = enteredWords.length > 0;

    const addWord = (word) => {
        setRemainedWords(remainedWords.filter((el) => el !== word));
        setEnteredWords([...enteredWords, word]);
    };
    const removeWord = () => {
        const updatedEnteredWords = [...enteredWords];
        const removedWord = updatedEnteredWords.pop();
        const updatedRemainedWords = [...remainedWords, removedWord].sort((a, b) => a > b);
        setRemainedWords(updatedRemainedWords);
        setEnteredWords(updatedEnteredWords);
    };

    useEffect(() => {
        if (enteredMnemonic.length > mnemonic) {
            const isEnteredMnemonicCorrect = enteredMnemonic.slice(0, -1) === mnemonic;
            onChange(isEnteredMnemonicCorrect);
        }
    }, [enteredMnemonic]);

    useEffect(() => {
        const words = mnemonic.split(' ');
        const wordsSorted = words.sort((a, b) => a > b);

        setRemainedWords(wordsSorted);
    }, [mnemonic]);

    return (
        <View style={styles.root}>
            <MnemonicView mnemonic={enteredMnemonic} isCopyDisabled isShown />
            {isBackspaceButtonShown && <ButtonPlain title="remove last word" style={styles.backspace} onPress={removeWord} />}
            <View style={styles.buttonContainer}>
                {remainedWords.map((item, index) => (
                    <TouchableOpacity onPress={() => addWord(item)} key={'mc' + index}>
                        <Text style={styles.button}>{item}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        width: '100%',
        backgroundColor: colors.bgForm,
        borderRadius: borders.borderRadiusForm,
    },
    backspace: {
        alignSelf: 'flex-end',
        margin: spacings.margin,
    },
    buttonContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-evenly',
        alignItems: 'center',
    },
    button: {
        ...fonts.label,
        borderRadius: borders.borderRadius,
        backgroundColor: colors.bgCard,
        margin: spacings.margin / 2,
        padding: spacings.padding / 2,
        backgroundColor: colors.accentLightForm,
        color: colors.textBody,
    },
});
