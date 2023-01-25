import React from 'react';
import { Image, View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { borders, colors, fonts, layout, spacings } from 'src/styles';
import { ButtonCopy, DialogBox, TouchableNative } from 'src/components';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useToggle, validateAccountName, validateRequired } from 'src/utils';
import { $t } from 'src/localization';

export const AccountCardWidget = props => {
    const { address, balance, name, ticker, isLoading, onNameChange, onReceivePress, onSendPress, onDetailsPress} = props;
    const [isNameEditShown, toggleNameEdit] = useToggle(false);
    const nameValidators = [validateRequired(), validateAccountName()];
    const touchableBackground = colors.accentLightForm;

    const handleNameChange = (newName) => {
        toggleNameEdit();
        onNameChange(newName);
    };

    return (
        <View style={styles.root}>
            <Image source={require('src/assets/images/art-passport.png')} style={styles.art} />
            {isLoading && <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />}
            <View style={styles.content}>
                <Text style={styles.textTitle}>{$t('c_accountCard_title_account')}</Text>
                <View style={layout.row}>
                    <Text style={styles.textName}>{name}</Text>
                    <TouchableOpacity hitSlop={5} onPress={toggleNameEdit}>
                        <Image source={require('src/assets/images/icon-edit.png')} style={styles.editIcon}/>
                    </TouchableOpacity>
                </View>
                <Text style={styles.textTitle}>{$t('c_accountCard_title_balance')}</Text>
                <View style={[layout.row, layout.alignEnd]}>
                    <Text style={styles.textBalance}>{balance}</Text>
                    <Text style={styles.textTicker}>{' ' + ticker}</Text>
                </View>
                <Text style={styles.textTitle}>{$t('c_accountCard_title_address')}</Text>
                <View style={layout.row}>
                    <Text style={styles.textAddress}>{address}</Text>
                    <ButtonCopy content={address} />
                </View>
            </View>
            <View style={styles.controls}>
                <View style={styles.button}>
                    <TouchableNative color={touchableBackground} onPress={onDetailsPress} style={styles.buttonPressable}>
                        <Image source={require('src/assets/images/icon-wallet.png')} style={styles.icon}/>
                        <Text style={styles.textButton}>{$t('c_accountCard_button_accountDetails')}</Text>
                    </TouchableNative>
                </View>
                <View style={styles.button}>
                    <TouchableNative color={touchableBackground} onPress={onSendPress} style={styles.buttonPressable}>
                        <Image source={require('src/assets/images/icon-send.png')} style={styles.icon}/>
                        <Text style={styles.textButton}>{$t('c_accountCard_button_send')}</Text>
                    </TouchableNative>
                </View>
                <View style={[styles.button, styles.clearBorderRight]}>
                    <TouchableNative color={touchableBackground} onPress={onReceivePress} style={styles.buttonPressable}>
                        <Image source={require('src/assets/images/icon-receive.png')} style={styles.icon}/>
                        <Text style={styles.textButton}>{$t('c_accountCard_button_receive')}</Text>
                    </TouchableNative>
                </View>
            </View>
            <DialogBox
                type="prompt" 
                title={$t('c_accountCard_prompt_title')}
                text={$t('c_accountCard_prompt_text')}
                promptValidators={nameValidators}
                isVisible={isNameEditShown} 
                onSuccess={handleNameChange} 
                onCancel={toggleNameEdit} 
            />
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        position: 'relative',
        width: '100%',
        backgroundColor: colors.accentLightForm,
        borderRadius: borders.borderRadiusForm,
        marginTop: 58,
    },
    art: {
        position: 'absolute',
        height: 201,
        width: 260,
        right: 0,
        top: -58,
        resizeMode: 'stretch'
    },
    loadingIndicator: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#0001'
    },
    content: {
        width: '100%',
        marginTop: 81,
        paddingHorizontal: spacings.padding,
        paddingBottom: spacings.padding2,
    },
    textTitle: {
        ...fonts.label,
        marginTop: spacings.margin,
        opacity: 0.7,
        color: colors.textForm,
    },
    textName: {
        ...fonts.title,
        color: colors.textForm,
    },
    editIcon: {
        width: 18,
        height: 18,
        marginLeft: spacings.margin / 2
    },
    textBalance: {
        ...fonts.body,
        fontSize: 36,
        lineHeight: 40,
        color: colors.textForm,
    },
    textTicker: {
        ...fonts.body,
        fontSize: 16,
        lineHeight: 28,
        color: colors.textForm,
    },
    textAddress: {
        ...fonts.body,
        color: colors.textForm,
        marginRight: spacings.margin / 2
    },
    controls: {
        flexDirection: 'row',
        backgroundColor: colors.accentForm,
        borderBottomLeftRadius: borders.borderRadiusForm,
        borderBottomRightRadius: borders.borderRadiusForm,
        overflow: 'hidden'
    },
    button: {
        height: 48,
        flex: 1,
        borderRightColor: colors.accentLightForm,
        borderRightWidth: 1,
    },
    buttonPressable: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row'
    },
    icon: {
        width: 18,
        height: 18,
        marginRight: spacings.paddingSm / 2
    },
    textButton: {
        ...fonts.button,
        fontSize: 15,
        color: colors.textForm,
    },
    clearBorderRight: {
        borderRightWidth: null
    },
});
