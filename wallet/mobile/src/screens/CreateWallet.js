import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Button, LoadingIndicator, Screen, Steps, StyledText, FormItem, MnemonicView, TextBox, ButtonClose, Checkbox } from 'src/components';
import store from 'src/store';
import { addressFromPrivateKey, createPrivateKeyFromMnemonic, downloadPaperWallet, generateMnemonic, publicAccountFromPrivateKey, publicKeyFromPrivateKey, usePasscode, useValidation, validateAccountName, validateRequired } from 'src/utils';
import { config } from 'src/config';
import { showMessage } from 'react-native-flash-message';

export const CreateWallet = (props) => {
    const { navigation } = props;
    const stepsCount = 2;
    const [step, setStep] = useState(1);
    // notranslate
    const [name, setName] = useState('My Account');
    const [mnemonic, setMnemonic] = useState('');
    const [isMnemonicShown, setIsMnemonicShown] = useState(false);
    const [isMnemonicDownloading, setIsMnemonicDownloading] = useState(false);
    const [isRiskAccepted, setIsRiskAccepted] = useState(false);
    // notranslate
    const nameErrorMessage = useValidation(name, [validateRequired(), validateAccountName()]);
    const isLoading = step > stepsCount || isMnemonicDownloading;
    const isButtonDisabled = [nameErrorMessage].some(el => !!el);
    
    const showMnemonic = () => setIsMnemonicShown(true);
    const downloadMnemonic = async () => {
        setIsMnemonicDownloading(true);
        setTimeout(async () => {
            try {
                const networkIdentifier = config.defaultNetworkIdentifier;
                const privateKey = createPrivateKeyFromMnemonic(0, mnemonic, networkIdentifier);
                const account = publicAccountFromPrivateKey(privateKey, networkIdentifier);
                await downloadPaperWallet(mnemonic, account, networkIdentifier);
                // notranslate
                showMessage({message: 'Downloaded', type: 'success'});
            }
            catch(error) {
                showMessage({message: error.message, type: 'danger'});
            }
            setIsMnemonicDownloading(false);
        });
    }
    const toggleAcceptRisk = () => setIsRiskAccepted(!isRiskAccepted);
    const close = () => {
        navigation.reset({
            index: 0,
            routes: [{ name: 'Welcome' }],
        });
    };
    const next = () => step === stepsCount ? createPasscode() : setStep(step + 1);
    const complete = async () => {
        await store.dispatchAction({ type: 'wallet/saveMnemonic', payload: { 
            mnemonic,
            name
        }});

        navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
        });
    }

    const createPasscode = usePasscode('choose', complete, close);

    useEffect(() => {
        const mnemonic = generateMnemonic();
        setMnemonic(mnemonic);
        setStep(1);
    }, []);

    return (
        <Screen bottomComponent={
            step === 1 && <FormItem bottom>
                {/* notranslate */}
                <Button title="Next" isDisabled={isButtonDisabled} onPress={next} />
            </FormItem>
        }>
            {isLoading && <LoadingIndicator />}
            <FormItem>
                <ButtonClose type="cancel" style={styles.buttonCancel} onPress={close} />
            </FormItem>
            <FormItem>
                <Image source={require('src/assets/images/logo-symbol-full.png')} style={styles.logo}/>
            </FormItem>
            <FormItem>
                <Steps stepsCount={stepsCount} currentStep={step} />
            </FormItem>
            <ScrollView>
                {step === 1 && (<>
                    <FormItem>
                        <StyledText type="title">
                            {/* notranslate  */}
                            Name Your First Account
                        </StyledText>
                        <StyledText type="body">
                            {/* notranslate  */}
                            Enter a name that allows you to easily identify your account or use the default below. You can also change the name later.
                        </StyledText>
                    </FormItem>
                    <FormItem>
                        <TextBox title="Account Name" value={name} errorMessage={nameErrorMessage} onChange={setName} />
                    </FormItem>
                </>)}
                {step === 2 && (<>
                    <FormItem>
                        <StyledText type="title">
                            {/* notranslate  */}
                            Secure your wallet
                        </StyledText>
                        <StyledText type="body">
                            {/* notranslate  */}
                            Your secret backup phrase (mnemonic) makes it easy to back up and restore your wallet.
                        </StyledText>
                    </FormItem>
                    <FormItem>
                        <StyledText type="body">
                            {/* notranslate  */}
                            WARNING: Never disclose your backup phrase. Anyone with this phrase can take your assets forever.
                        </StyledText>
                    </FormItem>
                    <FormItem>
                        <StyledText type="body">
                            {/* notranslate  */}
                            If you lose your wallet backup information, no one (including Symbol Wallet) can recover it, and you will lose any funds that are managed by the wallet.
                        </StyledText>
                    </FormItem>
                    <FormItem>
                        <MnemonicView mnemonic={mnemonic} isShown={isMnemonicShown} onShowPress={showMnemonic} />
                    </FormItem>
                    <FormItem>
                        {/* notranslate  */}
                        <Button title="Download mnemonic to file" onPress={downloadMnemonic} />
                    </FormItem>
                    <FormItem>
                        <StyledText type="title">
                            {/* notranslate  */}
                            Tips
                        </StyledText>
                        <StyledText type="body">
                            {/* notranslate  */}
                            Store this phrase in a password manager like 1Password.
                        </StyledText>
                    </FormItem>
                    <FormItem>
                        <StyledText type="body">
                            {/* notranslate  */}
                            Write this phrase on a piece of paper and store in a secure location. For additional security, write it down on multiple pieces of paper and store each in 2 - 3 different locations.
                        </StyledText>
                    </FormItem>
                    <FormItem>
                        <StyledText type="title">
                            {/* notranslate  */}
                            Confirm
                        </StyledText>
                        {/* notranslate  */}
                        <Checkbox title="I accept the risk that if I lose the phrase my funds may be lost " value={isRiskAccepted} onChange={toggleAcceptRisk} />
                    </FormItem>
                    <FormItem>
                        {/* notranslate  */}
                        <Button title="Next" isDisabled={!isRiskAccepted} onPress={next} />
                    </FormItem>
                </>)}
            </ScrollView>
        </Screen>
    );
};

const styles = StyleSheet.create({
    buttonCancel: {
        alignSelf: 'flex-end'
    },
    logo: {
        width: '100%',
        height: 48,
        margin: 'auto',
        resizeMode: 'contain',
    }
});
