import React, { useEffect, useState } from 'react';
import { Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StyledText, TextBox } from 'src/components';
import { $t } from 'src/localization';
import { borders, colors, fonts, spacings } from 'src/styles';
import { useValidation } from 'src/utils';

export const DialogBox = (props) => {
    const { isVisible, type, title, text, body, promptValidators, onSuccess, onCancel, style, contentContainerStyle } = props;
    const [promptValue, setPromptValue] = useState('');
    const promptErrorMessage = useValidation(promptValue, promptValidators || [], $t);
    const isPromptValueValid = !promptErrorMessage;

    const buttonOk = {
        text: $t('button_ok'),
        handler: onSuccess,
        style: styles.buttonPrimary,
    };
    const buttonPromptOk = {
        text: $t('button_ok'),
        handler: () => isPromptValueValid && onSuccess(promptValue),
        style: styles.buttonPrimary,
    };
    const buttonConfirm = {
        text: $t('button_confirm'),
        handler: onSuccess,
        style: styles.buttonPrimary,
    };
    const buttonAccept = {
        text: $t('button_accept'),
        handler: onSuccess,
        style: styles.buttonPrimary,
    };
    const buttonCancel = {
        text: $t('button_cancel'),
        handler: onCancel,
        style: styles.buttonSecondary,
    };
    const buttons = [];
    const isPrompt = type === 'prompt';

    switch (type) {
        case 'prompt':
            buttons.push(buttonPromptOk, buttonCancel);
            break;
        case 'accept':
            buttons.push(buttonAccept);
            break;
        case 'confirm':
            buttons.push(buttonConfirm, buttonCancel);
            break;
        case 'alert':
        default:
            buttons.push(buttonOk);
            break;
    }

    useEffect(() => setPromptValue(''), [isVisible]);

    return (
        <Modal animationType="fade" transparent visible={isVisible} onRequestClose={onCancel}>
            {isVisible && (
                <View style={styles.root}>
                    <SafeAreaView style={styles.modalContainer}>
                        <View style={[styles.modal, style]}>
                            <View style={[styles.content, contentContainerStyle]}>
                                <StyledText type="title">{title}</StyledText>
                                {text && !isPrompt && <StyledText type="body">{text}</StyledText>}
                                {body}
                                {isPrompt && (
                                    <TextBox title={text} errorMessage={promptErrorMessage} value={promptValue} onChange={setPromptValue} />
                                )}
                            </View>
                            <View style={styles.controls}>
                                {buttons.map((button, index) => (
                                    <View style={styles.button} key={'modalbtn' + index}>
                                        <TouchableOpacity onPress={button.handler} style={[styles.buttonPressable, button.style]}>
                                            <Text style={styles.textButton}>{button.text}</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </SafeAreaView>
                </View>
            )}
        </Modal>
    );
};

const styles = StyleSheet.create({
    root: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        top: 0,
        backgroundColor: '#000c',
        padding: spacings.padding,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modal: {
        width: '100%',
        minHeight: 150,
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: colors.bgMain,
        borderColor: colors.accentLightForm,
        borderRadius: borders.borderRadiusForm,
        overflow: 'hidden',
    },
    content: {
        padding: spacings.padding,
    },
    controls: {
        flexDirection: 'row',
        overflow: 'hidden',
        borderColor: colors.accentLightForm,
    },
    button: {
        height: 48,
        flex: 1,
        borderColor: colors.accentLightForm,
    },
    buttonPressable: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
    },
    buttonPrimary: {
        backgroundColor: colors.accentForm,
    },
    buttonSecondary: {
        backgroundColor: colors.formNeutral,
    },
    textButton: {
        ...fonts.button,
        fontSize: 15,
        color: colors.textForm,
    },
});
