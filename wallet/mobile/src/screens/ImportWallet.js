import React, { useState } from 'react';
import { Image, StyleSheet, } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Button, Screen, StyledText, FormItem, ButtonClose, ButtonPlain, MnemonicInput, QRScanner } from 'src/components';
import store from 'src/store';
import {usePasscode } from 'src/utils';
import { Router } from 'src/Router';

export const ImportWallet = () => {
    // notranslate
    const [name] = useState('First Account');
    const [mnemonic, setMnemonic] = useState('');
    const [isMnemonicValid, setIsMnemonicValid] = useState(false);
    const [isQRScannerVisible, setIsQRScannerVisible] = useState(false);
    const isButtonDisabled = !mnemonic.length ||  !isMnemonicValid;

    const toggleQRScanner = () => setIsQRScannerVisible(!isQRScannerVisible);
    const close = () => {
        Router.goToWelcome();
    };
    const next = () => createPasscode();
    const complete = async () => {
        await store.dispatchAction({ type: 'wallet/saveMnemonic', payload: { 
            mnemonic: mnemonic.trim(),
            name
        }});
        Router.goToHome();
    }

    const createPasscode = usePasscode('choose', complete, close);

    return (
        <Screen bottomComponent={
            <FormItem>
                {/* notranslate  */}
                <Button title="Next" isDisabled={isButtonDisabled} onPress={next} />
            </FormItem>
        }>
            <FormItem>
                <ButtonClose type="cancel" style={styles.buttonCancel} onPress={close} />
            </FormItem>
            <FormItem>
                <Image source={require('src/assets/images/logo-symbol-full.png')} style={styles.logo}/>
            </FormItem>
            <ScrollView>
                <FormItem>
                    <StyledText type="title">
                        {/* notranslate  */}
                        Import Mnemonic Backup Phrase
                    </StyledText>
                    <StyledText type="body">
                        {/* notranslate  */}
                        Your secret backup phrase (mnemonic) makes it easy to back up and restore your wallet.
                    </StyledText>
                </FormItem>
                <FormItem>
                    <MnemonicInput value={mnemonic} onChange={setMnemonic} onValidityChange={setIsMnemonicValid} />
                </FormItem>
                <FormItem>
                    {/* notranslate  */}
                    <ButtonPlain title="Scan QR-code" onPress={toggleQRScanner} />
                    <QRScanner isVisible={isQRScannerVisible} onClose={toggleQRScanner} onSuccess={setMnemonic} />
                </FormItem>
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
