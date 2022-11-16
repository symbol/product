import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Screen, Steps, StyledText, FormItem, MnemonicView, TextBox } from 'src/components';
import { generateMnemonic } from 'src/utils/wallet';

export const CreateWallet = () => {
    const stepsCount = 5;
    const [step, setStep] = useState(1);
    const [accountName, setAccountName] = useState('First Account');
    const [mnemonic, setMnemonic] = useState('');
    const [isMnemonicShown, setIsMnemonicShown] = useState(false);
    const next = () => setStep(step > stepsCount ? 1 : step + 1);

    useEffect(() => {
        const mnemonic = generateMnemonic();
        setMnemonic(mnemonic);
    }, []);

    return (
        <Screen>
            <FormItem>
                <Steps stepsCount={stepsCount} currentStep={step} />
            </FormItem>
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
                    <TextBox title="Account Name" value={accountName} onChange={setAccountName} />
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
            <FormItem>
                <Button title="Next" onPress={next} />
            </FormItem>
        </Screen>
    );
};
