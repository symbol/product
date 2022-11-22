import React, { useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { Button, ButtonPlain, Screen, StyledText, FormItem, Checkbox } from 'src/components';
import { colors, fonts, spacings } from 'src/styles';

export const Welcome = (props) => {
    const { navigation } = props;
    const [isTermsAccepted, setSsTermsAccepted] = useState(false);
    
    const toggleAcceptTerms = () => setSsTermsAccepted(!isTermsAccepted);
    const createWallet = () => navigation.navigate('CreateWallet');
    const importWallet = () => navigation.navigate('ImportWallet');

    return (
        <Screen 
            titleBar={<Image source={require('src/assets/images/art-welcome-bg-5.png')} style={styles.backgroundArt} />}
            bottomComponent={<>
            <FormItem>
                {/* notranslate  */}
                <Checkbox title="I accept terms and privacy policy" value={isTermsAccepted} onChange={toggleAcceptTerms} />
            </FormItem>
            <FormItem>
                {/* notranslate  */}
                <Button title="Create Wallet" isDisabled={!isTermsAccepted} onPress={createWallet} />
            </FormItem>
            <FormItem>
                {/* notranslate  */}
                <ButtonPlain title="Import Wallet" isDisabled={!isTermsAccepted} style={styles.buttonImport} onPress={importWallet} />
            </FormItem>
        </>}>
            <FormItem>
                <Image source={require('src/assets/images/logo-symbol-full.png')} style={styles.logo}/>
            </FormItem>
            <FormItem>
                <StyledText type="title" style={styles.title}>
                    {/* notranslate */}
                    {'Welcome to\nSymbol Wallet!'}
                </StyledText>
            </FormItem>
        </Screen>
    );
};

const styles = StyleSheet.create({
    backgroundArt: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    buttonImport: {
        alignSelf: 'center'
    },
    logo: {
        width: 156,
        height: 40,
        marginTop: spacings.margin * 2,
        resizeMode: 'contain',
    },
    title: {
        ...fonts.titleLarge,
        color: colors.accentLightForm,
    }
});
