import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { DialogBox, TextBox } from 'src/components';
import { $t } from 'src/localization';
import { colors, fonts } from 'src/styles';
import { useToggle, useValidation, validateAmount } from 'src/utils';

export const InputAmount = (props) => {
    const { title, value, availableBalance, onChange, onValidityChange } = props;
    const errorMessage = useValidation(value, [validateAmount(availableBalance)], $t);
    const isAvailableBalanceShown = availableBalance !== undefined;
    const [isConfirmVisible, toggleConfirm] = useToggle(false);

    const handleChange = (str) => {
        const formattedStr = str
            .replace(/,/g, '.')
            .replace(/[^.\d]/g, '')
            .replace(/^(\d*\.?)|(\d*)\.?/g, '$1$2');
        onChange(formattedStr);
    };
    const setMax = () => {
        handleChange('' + availableBalance);
        toggleConfirm();
    };

    useEffect(() => {
        onValidityChange && onValidityChange(!errorMessage);
    }, [value, errorMessage]);

    return (
        <>
            <TextBox
                title={title}
                keyboardType="decimal-pad"
                nativePlaceholder="0"
                errorMessage={errorMessage}
                value={value}
                onChange={handleChange}
                contentRight={
                    isAvailableBalanceShown && (
                        <TouchableOpacity onPress={toggleConfirm}>
                            <Text style={styles.availableBalanceText}>
                                {$t('c_inputAmount_label_available')}: {availableBalance}
                            </Text>
                        </TouchableOpacity>
                    )
                }
            />
            <DialogBox
                type="confirm"
                title={$t('c_inputAmount_confirm_title')}
                text={$t('c_inputAmount_confirm_text', { amount: availableBalance })}
                isVisible={isConfirmVisible}
                onSuccess={setMax}
                onCancel={toggleConfirm}
            />
        </>
    );
};

const styles = StyleSheet.create({
    availableBalanceText: {
        ...fonts.placeholder,
        color: colors.controlBaseTextAlt,
    },
});
