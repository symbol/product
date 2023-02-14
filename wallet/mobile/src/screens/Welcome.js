import React from 'react';
import { Image, ScrollView, StyleSheet } from 'react-native';
import { Button, ButtonPlain, DialogBox, FormItem, Screen, StyledText } from 'src/components';
import { termsAndPrivacy } from 'src/config';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import { colors, fonts, layout, spacings } from 'src/styles';
import { useToggle } from 'src/utils';

export const Welcome = () => {
    const [isTermsAndPrivacyShown, toggleTermsAndPrivacy] = useToggle(true);

    const createWallet = Router.goToCreateWallet;
    const importWallet = Router.goToImportWallet;

    return (
        <Screen
            titleBar={<Image source={require('src/assets/images/art-welcome-bg-5.png')} style={styles.backgroundArt} />}
            bottomComponent={
                <>
                    <FormItem>
                        <Button title={$t('button_walletCreate')} onPress={createWallet} />
                    </FormItem>
                    <FormItem>
                        <ButtonPlain title={$t('button_walletImport')} style={styles.buttonImport} onPress={importWallet} />
                    </FormItem>
                </>
            }
        >
            <ScrollView>
                <FormItem>
                    <Image source={require('src/assets/images/logo-symbol-full.png')} style={styles.logo} />
                </FormItem>
                <FormItem>
                    <StyledText type="title" style={styles.title}>
                        {$t('s_welcome_wallet_title')}
                    </StyledText>
                </FormItem>
            </ScrollView>
            <DialogBox
                type="accept"
                isVisible={isTermsAndPrivacyShown}
                onSuccess={toggleTermsAndPrivacy}
                style={layout.fill}
                contentContainerStyle={layout.fill}
                title={$t('s_welcome_modal_title')}
                body={
                    <ScrollView>
                        <StyledText type="title">{$t('s_welcome_modal_tnc')}</StyledText>
                        <StyledText type="body">{termsAndPrivacy.terms}</StyledText>
                        <StyledText type="title" />
                        <StyledText type="title">{$t('s_welcome_modal_privacy')}</StyledText>
                        <StyledText type="body">{termsAndPrivacy.privacy}</StyledText>
                    </ScrollView>
                }
            />
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
        alignSelf: 'center',
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
    },
});
