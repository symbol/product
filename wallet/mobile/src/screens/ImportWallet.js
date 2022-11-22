import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Button, LoadingIndicator, Screen, Steps, StyledText, FormItem, MnemonicView, TextBox, ButtonClose, Checkbox, ButtonPlain, MnemonicInput, QRScanner } from 'src/components';
import store from 'src/store';
import { downloadPaperWallet, generateMnemonic, usePasscode, useValidation, validateAccountName, validateRequired } from 'src/utils';
import { config } from 'src/config';
import { showMessage } from 'react-native-flash-message';

export const ImportWallet = (props) => {
    const { navigation } = props;
    const [isLoading, setIsLoading] = useState(false);
    // notranslate
    const [name, setName] = useState('First Account');
    const [mnemonic, setMnemonic] = useState('');
    const [isMnemonicValid, setIsMnemonicValid] = useState(false);
    const [isQRScannerVisible, setIsQRScannerVisible] = useState(false);
    const isButtonDisabled = isLoading || !mnemonic.length ||  !isMnemonicValid;

    const toggleQRScanner = () => setIsQRScannerVisible(!isQRScannerVisible);
    const close = () => {
        navigation.reset({
            index: 0,
            routes: [{ name: 'Welcome' }],
        });
    };
    const next = () => createPasscode();
    const complete = async () => {
        await store.dispatchAction({ type: 'wallet/saveMnemonic', payload: { 
            mnemonic: mnemonic.trim(),
            name
        }});

        navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
        });
    }

    const createPasscode = usePasscode('choose', complete, close);

    return (
        <Screen bottomComponent={
            <FormItem>
                {/* notranslate  */}
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
