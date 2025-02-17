import React, { useEffect, useState } from 'react';
import { DeviceEventEmitter, Image, StyleSheet, View } from 'react-native';
import PINCode, { hasUserSetPinCode } from '@haskkor/react-native-pincode';
import { colors, fonts, spacings } from '@/app/styles';
import { ButtonClose, LoadingIndicator } from '@/app/components';
import { $t } from '@/app/localization';
import { Router } from '@/app/Router';

export const Passcode = (props) => {
    const { route, hideCancelButton, keepListener, keepNavigation } = props;
    const { successEvent, cancelEvent, type } = route.params;
    const [isLoading, setIsLoading] = useState(true);
    const maxAttempts = 20;
    const onFinish = () => {
        setIsLoading(true);
        DeviceEventEmitter.emit(successEvent);

        if (!keepNavigation) {
            Router.goBack();
        }
    };

    const onCancel = () => {
        DeviceEventEmitter.emit(cancelEvent);

        if (!keepNavigation) {
            Router.goBack();
        }
    };

    useEffect(() => {
        const loadStatus = async () => {
            const isPasscodeEnabled = await hasUserSetPinCode();
            if (!isPasscodeEnabled && type === 'enter') {
                onFinish();
            } else {
                setIsLoading(false);
            }
        };
        loadStatus();

        if (!keepListener) {
            return () => {
                DeviceEventEmitter.removeAllListeners(successEvent);
                DeviceEventEmitter.removeAllListeners(cancelEvent);
            };
        }
    }, []);

    return (
        <View style={styles.root}>
            {!isLoading && (
                <>
                    <PINCode
                        status={type}
                        titleEnter={$t('s_passcode_titleEnter')}
                        titleChoose={$t('s_passcode_titleChoose')}
                        subtitleChoose={$t('s_passcode_subtitleChoose')}
                        titleConfirm={$t('s_passcode_titleConfirm')}
                        subtitleConfirm={$t('s_passcode_subtitleConfirm')}
                        titleAttemptFailed={$t('s_passcode_titleAttemptFailed')}
                        subtitleError={$t('s_passcode_subtitleError')}
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
                        numbersButtonOverlayColor={colors.secondary}
                        colorCircleButtons={colors.primary}
                        colorPassword={colors.primary}
                        buttonDeleteText="Delete"
                        stylePinCodeDeleteButtonText={fonts.button}
                        stylePinCodeColumnDeleteButton={styles.buttonDelete}
                        styleLockScreenColorIcon={styles.buttonDelete}
                        customBackSpaceIcon={() => (
                            <Image source={require('@/app/assets/images/icon-backspace.png')} style={styles.buttonBackspace} />
                        )}
                        finishProcess={onFinish}
                        touchIDDisabled={type === 'choose'}
                    />
                    {!hideCancelButton && <ButtonClose type="cancel" style={styles.buttonCancel} onPress={onCancel} />}
                </>
            )}
            {isLoading && <LoadingIndicator fill />}
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        position: 'relative',
        width: '100%',
        height: '100%',
    },
    styleMainContainer: {
        backgroundColor: colors.bgMain,
    },
    buttonCancel: {
        position: 'absolute',
        right: spacings.margin,
        top: spacings.margin,
    },
    buttonBackspace: {
        height: '100%',
        width: 30,
        margin: 'auto',
        resizeMode: 'contain',
    },
});
