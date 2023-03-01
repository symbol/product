import React, { useEffect, useRef, useState } from 'react';
import * as bip39 from 'bip39';
import { Platform, StyleSheet, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { StyledText, TextBox, TouchableNative } from 'src/components';
import { $t } from 'src/localization';
import { borders, colors, fonts, spacings } from 'src/styles';
import { useValidation, validateMnemonic, validateRequired } from 'src/utils';
import _ from 'lodash';

export const MnemonicInput = (props) => {
    const { testID, value, onChange, onValidityChange } = props;
    const textBoxRef = useRef();
    const errorMessage = useValidation(value, [validateRequired(), validateMnemonic()], $t);
    const [suggestions, setSuggestions] = useState([]);
    const wordlist = bip39.wordlists['english'];

    const handleChange = (str) => {
        const formattedString = str
            .replace(/(\r\n|\n|\r)/gm, ' ')
            .replace(/\s+/g, ' ')
            .toLowerCase();
        onChange(formattedString);
        
        const lastWord = formattedString.split(' ').pop();
        const suggestions = _.filter(wordlist, word => 
            word.startsWith(lastWord)
        );
        const isSuggestionsShown = suggestions.length < 20;
        setSuggestions(isSuggestionsShown ? suggestions : []);
    }
    const handleSuggestionPress = (word) => {
        const lastSpaceIndex = value.lastIndexOf(' ');
        const stringWithoutLastWord = value.substring(0, lastSpaceIndex);
        handleChange(`${stringWithoutLastWord} ${word} `);
        textBoxRef.current.focus();
    }

    useEffect(() => {
        onValidityChange(!errorMessage);
    }, [value, errorMessage]);

    return (
        <View style={styles.root}>
            <TextBox 
                multiline 
                innerRef={textBoxRef}
                testID={testID} 
                errorMessage={errorMessage} 
                value={value}
                keyboardType={Platform.OS === 'ios' ? null : 'visible-password'}
                onChange={handleChange} 
            />
            <View style={styles.suggestionsWrapper}>
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.suggestions}
                    contentContainerStyle={styles.list}
                    data={suggestions}
                    keyExtractor={(_, index) => 'sg' + index}
                    renderItem={({ item }) => (
                        <View style={styles.button}>
                            <TouchableNative 
                                containerStyle={styles.buttonInner}
                                color={colors.bgCard}
                                onPress={() => handleSuggestionPress(item)}
                            >
                                <StyledText type="label" style={styles.text}>{item}</StyledText>
                            </TouchableNative>
                        </View>
                    )}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        position: 'relative',
    },
    suggestionsWrapper: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        paddingHorizontal: borders.borderWidth
    },
    suggestions: {
        width: '100%',
        height: spacings.margin + spacings.margin + fonts.label.lineHeight,
    },
    list: {
        paddingVertical: spacings.margin / 2,
        paddingLeft: spacings.margin,
    },
    button: {
        marginRight: spacings.margin,
        overflow: 'hidden',
        borderRadius: borders.borderRadiusForm,
        backgroundColor: colors.primary,
    },
    buttonInner: {
        paddingHorizontal: spacings.margin,
        paddingVertical: spacings.margin / 2,
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%'
    },
    text: {
        fontSize: 13,
        color: colors.bgMain
    },
});
