import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { DialogBox, TextBox } from 'src/components';
import { $t } from 'src/localization';
import { colors, fonts } from 'src/styles';
import { getUserCurrencyAmountText, useToggle, useValidation, validateAmount } from 'src/utils';

export const InputAmount = (props) => {
    const { title, value, price, networkIdentifier, availableBalance, onChange, onValidityChange } = props;
    const errorMessage = useValidation(value, [validateAmount(availableBalance)], $t);
    const isAvailableBalanceShown = availableBalance !== undefined;
    const [isConfirmVisible, toggleConfirm] = useToggle(false);
    const [priceText, setPriceText] = useState('');
    const availableBalanceTextStyle = availableBalance ? styles.availableBalanceText : styles.availableBalanceTextError;

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
        setPriceText(getUserCurrencyAmountText(value, price, networkIdentifier));
    }, [value, errorMessage, price, networkIdentifier]);

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
                    <View style={styles.contentRight}>
                        {!!priceText && <Text style={styles.priceText}>{priceText}</Text>}
                        {isAvailableBalanceShown && (
                            <TouchableOpacity onPress={toggleConfirm} disabled={!availableBalance}>
                                <Text style={availableBalanceTextStyle}>
                                    {$t('c_inputAmount_label_available')}: {availableBalance}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
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
    priceText: {
        ...fonts.placeholder,
        color: colors.controlBaseTextAlt,
    },
    availableBalanceText: {
        ...fonts.placeholder,
        color: colors.primary,
    },
    availableBalanceTextError: {
        ...fonts.placeholder,
        color: colors.danger,
    },
    contentRight: {
        flexDirection: 'column',
        alignItems: 'flex-end',
    },
});
