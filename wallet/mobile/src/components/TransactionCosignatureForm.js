import { useIsFocused } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { $t } from '@/app/localization';
import { Router } from '@/app/Router';
import { borders, colors, layout, spacings } from '@/app/styles';
import { handleError, isTransactionAwaitingSignatureByAccount } from '@/app/utils';
import { useDataManager, usePasscode } from '@/app/hooks';
import { Button } from './Button';
import { ButtonPlain } from './ButtonPlain';
import { LoadingIndicator } from './LoadingIndicator';
import { StyledText } from './StyledText';
import WalletController from '@/app/lib/controller/MobileWalletController';
import { observer } from 'mobx-react-lite';

export const TransactionCosignatureForm = observer(function TransactionCosignatureForm(props) {
    const { style, height, transaction } = props;
    const { signerAddress } = transaction;
    const { currentAccount, currentAccountInfo, networkIdentifier, accounts } = WalletController;
    const { isMultisig } = currentAccountInfo;
    const { addressBook } = WalletController.modules;
    const networkWalletAccounts = accounts[networkIdentifier];
    const animatedHeight = useSharedValue(0);
    const animatedStyle = useAnimatedStyle(() => ({
        maxHeight: animatedHeight.value,
    }));
    const isFocused = useIsFocused();
    const rootStyle = [styles.root, animatedStyle, style];

    const isAwaitingSignature = isTransactionAwaitingSignatureByAccount(transaction, currentAccount) && !isMultisig;
    const signerContact = addressBook.getContactByAddress(signerAddress);
    const isBlackListedSigner = !!signerContact && signerContact.isBlackListed;
    const isWhiteListedSigner = !!signerContact && !isBlackListedSigner;
    const isWalletAccount = networkWalletAccounts.some((account) => account.address === signerAddress);
    const isTrustedSigner = isWhiteListedSigner || isWalletAccount;
    let viewId = null;

    if (isAwaitingSignature && isBlackListedSigner) {
        viewId = 'blocked_signer_initial';
    } else if (isAwaitingSignature && isTrustedSigner) {
        viewId = 'trusted_signer_initial';
    } else if (isAwaitingSignature) {
        viewId = 'unknown_signer_initial';
    }

    const [sign, isLoading] = useDataManager(
        async () => {
            await WalletController.cosignAndAnnounceTransaction(transaction);
            Router.goToHistory();
        },
        null,
        handleError
    );
    const confirmSend = usePasscode('enter', sign);
    const addContact = (list) => {
        Router.goBack();
        Router.goToAddressBookEdit({ address: signerAddress, list });
    };

    useEffect(() => {
        animatedHeight.value = withTiming(height);
    }, [isFocused]);

    const views = {
        blocked_signer_initial: (
            <>
                <View style={styles.content}>
                    <Image style={styles.icon} source={require('@/app/assets/images/icon-danger-alert.png')} />
                    <StyledText type="subtitle">{$t('s_transactionDetails_cosignatureForm_title')}</StyledText>
                    <StyledText type="body">{$t('s_transactionDetails_cosignatureForm_blocked_description')}</StyledText>
                </View>
                <ButtonPlain title="View contact" onPress={() => Router.goToAddressBookContact({ id: signerContact.id })} />
            </>
        ),
        trusted_signer_initial: (
            <>
                <View style={styles.content}>
                    <Image style={styles.icon} source={require('@/app/assets/images/icon-status-partial-1.png')} />
                    <StyledText type="subtitle">{$t('s_transactionDetails_cosignatureForm_title')}</StyledText>
                    <StyledText type="body">{$t('s_transactionDetails_cosignatureForm_trusted_description')}</StyledText>
                </View>
                <Button title="Sign" onPress={confirmSend} />
            </>
        ),
        unknown_signer_initial: (
            <>
                <View style={styles.content}>
                    <Image style={styles.icon} source={require('@/app/assets/images/icon-warning-alert.png')} />
                    <StyledText type="subtitle">{$t('s_transactionDetails_cosignatureForm_title')}</StyledText>
                    <StyledText type="body">{$t('s_transactionDetails_cosignatureForm_unknown_description')}</StyledText>
                </View>
                <View style={[layout.row, layout.justifyBetween]}>
                    <ButtonPlain title={$t('button_addToWhitelist')} onPress={() => addContact('whitelist')} />
                    <ButtonPlain title={$t('button_addToBlacklist')} onPress={() => addContact('blacklist')} />
                </View>
            </>
        ),
    };

    return (
        !!viewId && (
            <Animated.View style={rootStyle}>
                <ScrollView>
                    {views[viewId]}
                    {isLoading && <LoadingIndicator />}
                </ScrollView>
            </Animated.View>
        )
    );
});

const styles = StyleSheet.create({
    root: {
        backgroundColor: colors.accentForm,
        borderTopLeftRadius: borders.borderRadiusForm,
        borderTopRightRadius: borders.borderRadiusForm,
        padding: spacings.padding,
    },
    content: {
        flex: 1,
        marginBottom: spacings.margin,
    },
    icon: {
        width: 24,
        height: 24,
    },
    titleWarning: {
        color: colors.warning,
    },
    titleDander: {
        color: colors.danger,
    },
});
