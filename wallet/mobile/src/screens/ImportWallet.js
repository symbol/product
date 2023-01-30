import React, { useState } from 'react';
import { Image, StyleSheet, } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Button, Screen, StyledText, FormItem, ButtonClose, ButtonPlain, MnemonicInput, QRScanner, QRCode } from 'src/components';
import store from 'src/store';
import { usePasscode } from 'src/utils';
import { Router } from 'src/Router';
import { $t } from 'src/localization';

export const ImportWallet = () => {
    const [name] = useState($t('s_importWallet_defaultAccountName'));
    const [mnemonic, setMnemonic] = useState('');
    const [isMnemonicValid, setIsMnemonicValid] = useState(false);
    const [isQRScannerVisible, setIsQRScannerVisible] = useState(false);
    const isButtonDisabled = !mnemonic.length || !isMnemonicValid;

    const toggleQRScanner = () => setIsQRScannerVisible(!isQRScannerVisible);
    const next = () => createPasscode();
    const complete = async () => {
        await store.dispatchAction({ type: 'wallet/saveMnemonic', payload: { 
            mnemonic: mnemonic.trim(),
            name
        }});
        Router.goToHome();
    }
    const createPasscode = usePasscode('choose', complete, Router.goBack);

    return (
        <Screen bottomComponent={
            <FormItem>
                <Button title={$t('button_next')} isDisabled={isButtonDisabled} onPress={next} />
            </FormItem>
        }>
            <FormItem>
                <ButtonClose type="cancel" style={styles.buttonCancel} onPress={Router.goBack} />
            </FormItem>
            <FormItem>
                <Image source={require('src/assets/images/logo-symbol-full.png')} style={styles.logo}/>
            </FormItem>
            <ScrollView>
                <FormItem>
                    <StyledText type="title">{$t('s_importWallet_title')}</StyledText>
                    <StyledText type="body">{$t('s_importWallet_text')}</StyledText>
                </FormItem>
                <FormItem>
                    <MnemonicInput value={mnemonic} onChange={setMnemonic} onValidityChange={setIsMnemonicValid} />
                </FormItem>
                <FormItem>
                    <ButtonPlain title={$t('button_scanQR')} onPress={toggleQRScanner} />
                    <QRScanner 
                        type={QRCode.QRTypes.mnemonic}
                        isVisible={isQRScannerVisible} 
                        onClose={toggleQRScanner} 
                        onSuccess={setMnemonic} 
                    />
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
