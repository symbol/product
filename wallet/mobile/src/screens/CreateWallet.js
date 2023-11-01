import React, { useEffect, useState } from 'react';
import { DeviceEventEmitter, Image, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { showMessage } from 'react-native-flash-message';
import {
    Button,
    ButtonClose,
    Checkbox,
    FormItem,
    MnemonicView,
    Screen,
    Steps,
    StyledText,
    TextBox,
    WalletCreationAnimation,
} from 'src/components';
import store from 'src/store';
import {
    createPrivateKeysFromMnemonic,
    downloadPaperWallet,
    generateMnemonic,
    handleError,
    publicAccountFromPrivateKey,
    useDataManager,
    usePasscode,
    useToggle,
    useValidation,
    validateAccountName,
    validateRequired,
} from 'src/utils';
import { Constants, config } from 'src/config';
import { Router } from 'src/Router';
import { $t } from 'src/localization';

export const CreateWallet = () => {
    const stepsCount = 2;
    const [step, setStep] = useState(1);
    const [name, setName] = useState($t('s_createWallet_defaultAccountName'));
    const [mnemonic, setMnemonic] = useState('');
    const [isMnemonicShown, setIsMnemonicShown] = useState(false);
    const [isRiskAccepted, toggleAcceptRisk] = useToggle(false);
    const nameErrorMessage = useValidation(name, [validateRequired(), validateAccountName()], $t);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState(1);
    const loadingSteps = [
        $t('s_createWallet_loading_step1'),
        $t('s_createWallet_loading_step2'),
        $t('s_createWallet_loading_step3'),
        $t('s_createWallet_loading_step4'),
    ];

    const showMnemonic = () => setIsMnemonicShown(true);
    const [downloadMnemonic, isMnemonicDownloading] = useDataManager(
        async () => {
            const networkIdentifier = config.defaultNetworkIdentifier;
            const [privateKey] = createPrivateKeysFromMnemonic(mnemonic, [0], networkIdentifier);
            const account = publicAccountFromPrivateKey(privateKey, networkIdentifier);
            await downloadPaperWallet(mnemonic, account, networkIdentifier);
            showMessage({ message: $t('message_downloaded'), type: 'success' });
        },
        null,
        handleError
    );
    const next = () => (step === stepsCount ? createPasscode() : setStep(step + 1));
    const startLoading = () => {
        setIsLoading(true);
        setTimeout(() => setLoadingStep(2), 500);
        setTimeout(() => setLoadingStep(3), 1000);
        setTimeout(saveMnemonic, 1500);
    };
    const completeLoading = async () => {
        DeviceEventEmitter.emit(Constants.Events.LOGIN);
    };
    const [saveMnemonic] = useDataManager(
        async () => {
            await store.dispatchAction({
                type: 'wallet/saveMnemonic',
                payload: {
                    mnemonic,
                    name,
                },
            });
            setLoadingStep(4);
            setTimeout(completeLoading, 500);
        },
        null,
        handleError
    );
    const createPasscode = usePasscode('choose', startLoading);

    useEffect(() => {
        const mnemonic = generateMnemonic();
        setMnemonic(mnemonic);
        setStep(1);
    }, []);

    return (
        <Screen
            isLoading={isMnemonicDownloading}
            bottomComponent={
                step === 1 && (
                    <FormItem bottom>
                        <Button title={$t('button_next')} isDisabled={!!nameErrorMessage} onPress={next} />
                    </FormItem>
                )
            }
        >
            {isLoading && <WalletCreationAnimation steps={loadingSteps} currentStep={loadingStep} />}
            <FormItem>
                <ButtonClose type="cancel" style={styles.buttonCancel} onPress={Router.goBack} />
            </FormItem>
            <FormItem>
                <Image source={require('src/assets/images/logo-symbol-full.png')} style={styles.logo} />
            </FormItem>
            <FormItem>
                <Steps stepsCount={stepsCount} currentStep={step} />
            </FormItem>
            <ScrollView>
                {step === 1 && (
                    <>
                        <FormItem>
                            <StyledText type="title">{$t('s_createWallet_accountName_title')}</StyledText>
                            <StyledText type="body">{$t('s_createWallet_accountName_text')}</StyledText>
                        </FormItem>
                        <FormItem>
                            <TextBox
                                title={$t('s_createWallet_accountName_input')}
                                value={name}
                                errorMessage={nameErrorMessage}
                                onChange={setName}
                            />
                        </FormItem>
                    </>
                )}
                {step === 2 && (
                    <>
                        <FormItem>
                            <StyledText type="title">{$t('s_createWallet_mnemonic_title')}</StyledText>
                            <StyledText type="body">{$t('s_createWallet_mnemonic_text_p1')}</StyledText>
                        </FormItem>
                        <FormItem>
                            <StyledText type="body">{$t('s_createWallet_mnemonic_text_p2')}</StyledText>
                        </FormItem>
                        <FormItem>
                            <StyledText type="body">{$t('s_createWallet_mnemonic_text_p3')}</StyledText>
                        </FormItem>
                        <FormItem>
                            <MnemonicView mnemonic={mnemonic} isShown={isMnemonicShown} onShowPress={showMnemonic} />
                        </FormItem>
                        <FormItem>
                            <Button title={$t('button_downloadBackup')} onPress={downloadMnemonic} />
                        </FormItem>
                        <FormItem>
                            <StyledText type="title">{$t('s_createWallet_tips_title')}</StyledText>
                            <StyledText type="body">{$t('s_createWallet_tips_text_p1')}</StyledText>
                        </FormItem>
                        <FormItem>
                            <StyledText type="body">{$t('s_createWallet_tips_text_p2')}</StyledText>
                        </FormItem>
                        <FormItem>
                            <StyledText type="title">{$t('s_createWallet_confirm_title')}</StyledText>
                            <Checkbox title={$t('s_createWallet_confirm_checkbox')} value={isRiskAccepted} onChange={toggleAcceptRisk} />
                        </FormItem>
                        <FormItem>
                            <Button title={$t('button_next')} isDisabled={!isRiskAccepted} onPress={next} />
                        </FormItem>
                    </>
                )}
            </ScrollView>
        </Screen>
    );
};

const styles = StyleSheet.create({
    buttonCancel: {
        alignSelf: 'flex-end',
    },
    logo: {
        width: '100%',
        height: 48,
        margin: 'auto',
        resizeMode: 'contain',
    },
});
