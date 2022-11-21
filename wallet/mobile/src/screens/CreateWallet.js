import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Button, LoadingIndicator, Screen, Steps, StyledText, FormItem, MnemonicView, TextBox, ButtonClose } from 'src/components';
import store from 'src/store';
import { generateMnemonic, usePasscode, useValidation, validateAccountName, validateRequired } from 'src/utils';

export const CreateWallet = (props) => {
    const { navigation } = props;
    const stepsCount = 3;
    const [step, setStep] = useState(1);
    // notranslate
    const [name, setName] = useState('My Account');
    const [mnemonic, setMnemonic] = useState('');
    const [isMnemonicShown, setIsMnemonicShown] = useState(false);
    // notranslate
    const nameErrorMessage = useValidation(name, [validateRequired(), validateAccountName()]);
    const isLoading = step > stepsCount;
    const isButtonDisabled = [nameErrorMessage].some(el => !!el);
    
    const close = () => {
        navigation.reset({
            index: 0,
            routes: [{ name: 'Welcome' }],
        });
    };
    const next = () => {
        if (step === stepsCount) {
            createPasscode();
        }

        setStep(step + 1);
    }
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
            <FormItem bottom>
                {/* notranslate */}
                <Button title="Next" isDisabled={isButtonDisabled} onPress={next} />
            </FormItem>
        }>
            <FormItem>
                <ButtonClose type="cancel" onPress={close} />
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
                        <MnemonicView 
                            mnemonic={mnemonic}
                            isShown={isMnemonicShown}
                            onShowPress={() => setIsMnemonicShown(true)}
                        />
                    </FormItem>
                    <FormItem>
                        <StyledText type="title">
                            {/* notranslate  */}
                            Tips:
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
                        <StyledText type="body">
                            {/* notranslate  */}
                            Memorize this phrase.
                        </StyledText>
                    </FormItem>
                </>)}
                {step === 3 && (<>
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
                        <MnemonicView 
                            mnemonic={mnemonic}
                            isShown={isMnemonicShown}
                            onShowPress={() => setIsMnemonicShown(true)}
                        />
                    </FormItem>
                    <FormItem>
                        <StyledText type="title">
                            {/* notranslate  */}
                            Tips:
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
                        <StyledText type="body">
                            {/* notranslate  */}
                            Memorize this phrase.
                        </StyledText>
                    </FormItem>
                </>)}
                {isLoading && <LoadingIndicator />}
            </ScrollView>
        </Screen>
    );
};

const styles = StyleSheet.create({
    logo: {
        width: '100%',
        height: 48,
        margin: 'auto',
        resizeMode: 'contain',
    }
});
