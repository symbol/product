import React, { useEffect, useState } from 'react';
import { DeviceEventEmitter, Image, StyleSheet, View } from 'react-native';
import PINCode, { hasUserSetPinCode } from '@haskkor/react-native-pincode';
import { colors, fonts } from 'src/styles';
import { LoadingIndicator } from 'src/components';

const translate = _ => _;

export const Passcode = (props) => {
    const { showCancel, route, keepListener } = props;
    const { successEvent, cancelEvent, type } = route.params;
    const [isLoading, setIsLoading] = useState(true);
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
            const isPasscodeEnabled = await hasUserSetPinCode();
            if (!isPasscodeEnabled && type === 'enter') {
                onFinish(); 
            }
            else {
                setIsLoading(false);
            }
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
                titleEnter={translate('Unlock the Wallet')}
                titleChoose={translate('Create a PIN')}
                subtitleChoose={translate('Enter new PIN-code')}
                titleConfirm={translate('Confirm')}
                subtitleConfirm={translate('Enter PIN-code again')}     
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
                touchIDDisabled={type === 'choose'}
            />}
            {isLoading && <LoadingIndicator fill />}
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
