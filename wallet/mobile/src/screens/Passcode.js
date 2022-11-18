import React, { Component, useEffect, useState } from 'react';
import { BackHandler, DeviceEventEmitter, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PINCode, { hasUserSetPinCode } from '@haskkor/react-native-pincode';
import { colors, fonts } from 'src/styles';
import { LoadingIndicator } from 'src/components';
import { useRoute } from '@react-navigation/native';

const translate = _ => _;

export const Passcode = (props) => {
    const { showCancel, route, keepListener } = props;
    const { successEvent, cancelEvent } = route.params;
    const [isPasscodeEnabled, setIsPasscodeEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const type = isPasscodeEnabled ? 'enter' : 'choose';
    const titleText = isPasscodeEnabled
        ? translate('Unlock the Wallet')
        : translate('Create a PIN');
    const maxAttempts = 20;
    const onFinish = () => {
        setIsLoading(true)
        DeviceEventEmitter.emit(successEvent);
    }
    const onCancel = () => {
        DeviceEventEmitter.emit(cancelEvent);
    }

    useEffect(() => {
        const loadStatus = async () => {
            const status = await hasUserSetPinCode();
            setIsPasscodeEnabled(status);
            setIsLoading(false);
        };
        loadStatus();

        if(!keepListener) {
            return () => {
                DeviceEventEmitter.removeAllListeners(successEvent);
                DeviceEventEmitter.removeAllListeners(cancelEvent);
            };
        }
    }, []);

    return (
        <View style={styles.root}>
            {!isLoading && <PINCode
                status={type}
                titleEnter={titleText}
                titleChoose={translate('Create a PIN')}
                subtitleChoose={translate('Use dialpad below')}
                titleConfirm={translate('Create a PIN')}
                subtitleConfirm={translate('Please confirm')}     
                titleAttemptFailed={translate('Attempt Failed')}
                subtitleError={translate('Incorrect')}
                maxAttempts={maxAttempts}
                stylePinCodeTextTitle={fonts.title}
                stylePinCodeTextSubtitle={fonts.body}
                stylePinCodeColorTitle={colors.textBody}
                stylePinCodeColorTitleError={colors.danger}
                stylePinCodeColorSubtitle={colors.textForm}
                stylePinCodeColorSubtitleError={colors.danger}
                stylePinCodeButtonNumber={colors.bgMain}
                styleMainContainer={styles.styleMainContainer} //
                stylePinCodeTextButtonCircle={fonts.button}
                // buttonComponentLockedPage={() => null}
                // iconComponentLockedPage={() => null}
                numbersButtonOverlayColor={colors.secondary}
                colorCircleButtons={colors.primary}
                colorPassword={colors.primary}
                buttonDeleteText="Delete"
                stylePinCodeDeleteButtonText={fonts.button}
                stylePinCodeColumnDeleteButton={styles.buttonDelete}
                styleLockScreenColorIcon={styles.buttonDelete}
                customBackSpaceIcon={() => (
                    <Image source={require('src/assets/images/icon-backspace.png')} style={styles.buttonDelete} />
                )}
                // bottomLeftComponent={(!isPasscodeEnabled || showCancel) && this.renderCustomCancel()}
                finishProcess={onFinish}
                touchIDDisabled={!isPasscodeEnabled}
            />}
            {isLoading && <LoadingIndicator />}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        width: '100%',
        height: '100%',
    },
    styleMainContainer: {
        backgroundColor: colors.bgMain
    },
    buttonDelete: {
        height: '100%',
        width: 30,
        margin: 'auto',
        resizeMode: 'contain'
    }
});
