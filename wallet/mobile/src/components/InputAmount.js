import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { TextBox } from 'src/components';
import { $t } from 'src/localization';
import { colors, fonts } from 'src/styles';
import { useValidation, validateAmount } from 'src/utils';

export const InputAmount = props => {
    const { title, value, availableBalance, onChange, onValidityChange } = props;
    const errorMessage = useValidation(value, [validateAmount(availableBalance)], $t);
    const isAvailableBalanceShown = availableBalance !== undefined;

    const handleChange = str => {
        const formattedStr = str
            .replace(/,/g, '.')
            .replace(/[^.\d]/g, '')
            .replace(/^(\d*\.?)|(\d*)\.?/g, '$1$2');
        onChange(formattedStr);
    }
    const setMax = () => {
        handleChange('' + availableBalance);
    };

    useEffect(() => {
        onValidityChange && onValidityChange(!errorMessage)
    }, [value, errorMessage])

    return (
        <TextBox 
            title={title}
            keyboardType="decimal-pad"
            nativePlaceholder="0"
            errorMessage={errorMessage} 
            value={value} 
            onChange={handleChange}
            contentRight={(isAvailableBalanceShown &&
                <TouchableOpacity onPress={setMax}>
                    <Text style={styles.availableBalanceText}>Available: {availableBalance}</Text>
                </TouchableOpacity>
            )}
        />
    );
};

const styles = StyleSheet.create({
    availableBalanceText: {
        ...fonts.placeholder,
        color: colors.controlBaseTextAlt,
    },
});
