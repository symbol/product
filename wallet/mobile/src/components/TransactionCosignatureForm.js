import { useIsFocused } from '@react-navigation/native';
import _ from 'lodash';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withDecay, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import { TransactionService } from 'src/services';
import { connect } from 'src/store';
import { borders, colors, spacings } from 'src/styles';
import { handleError, transactionAwaitingSignatureByAccount, useDataManager, usePasscode } from 'src/utils';
import { Button } from './Button';
import { ButtonPlain } from './ButtonPlain';
import { LoadingIndicator } from './LoadingIndicator';
import { StyledText } from './StyledText';

export const TransactionCosignatureForm = connect(state => ({
    addressBook: state.addressBook.addressBook,
    walletAccounts: state.wallet.accounts,
    currentAccount: state.account.current,
    networkIdentifier: state.network.networkIdentifier,
    networkProperties: state.network.networkProperties,
}))(function TransactionCosignatureForm(props) {
    const { style, height, transaction, addressBook, currentAccount, networkIdentifier, networkProperties, walletAccounts } = props;
    const { signerAddress } = transaction;
    const networkWalletAccounts = walletAccounts[networkIdentifier];
    const animatedHeight = useSharedValue(0);
    const animatedStyle = useAnimatedStyle(() => ({
        maxHeight: animatedHeight.value,
    }));
    const isFocused = useIsFocused();
    const rootStyle = [
        styles.root, 
        animatedStyle, 
        style,
    ]

    const isAwaitingSignature = transactionAwaitingSignatureByAccount(transaction, currentAccount);
    const signerContact = addressBook.getContactByAddress(signerAddress);
    const isBlackListedSigner = signerContact && signerContact.isBlackListed;
    const isWhiteListedSigner = signerContact && !isBlackListedSigner;
    const isWalletAccount = networkWalletAccounts.some(account => account.address === signerAddress);
    const isTrustedSigner = isWhiteListedSigner || isWalletAccount;
    let viewId = null;

    if (isAwaitingSignature && isBlackListedSigner) {
        viewId = 'blocked_signer_initial'
    }
    else if (isAwaitingSignature && isTrustedSigner) {
        viewId = 'trusted_signer_initial'
    }
    else if (isAwaitingSignature) {
        viewId = 'unknown_signer_initial'
    }

    const [sign, isLoading] = useDataManager(async () => {
        await TransactionService.cosignTransaction(transaction, currentAccount, networkProperties);
        Router.goToHistory();
    }, null, handleError);
    const confirmSend = usePasscode('enter', sign, Router.goBack);

    useEffect(() => {
        animatedHeight.value = withTiming(height);
    }, [isFocused]);

    /* notranslate */
    const views = {
        'blocked_signer_initial': <>
            <View style={styles.content}>
                <Image style={styles.icon} source={require('src/assets/images/icon-danger-alert.png')} />
                <StyledText type="subtitle">Transaction Awaiting Signature</StyledText>
                <StyledText type="body">Sender (signer) of this thransaction is on your blacklist. If you wish to accept this transaction, please remove this contact from your blacklist.</StyledText>
            </View>
            <ButtonPlain title="View contact" onPress={() => Router.goToAddressBookContact({id: signerContact.id})}/>
        </>,
        'trusted_signer_initial': <>
            <View style={styles.content}>
                <Image style={styles.icon} source={require('src/assets/images/icon-status-partial-1.png')} />
                <StyledText type="subtitle">Transaction Awaiting Signature</StyledText>
                <StyledText type="body">Please carefully review all amounts and recipient addresses, as transactions are not reversible. Malicious transactions can result in a total loss of funds.</StyledText>
            </View>
            <Button title="Sign" onPress={confirmSend} />
        </>,
        'unknown_signer_initial': <>
            <View style={styles.content}>
                <Image style={styles.icon} source={require('src/assets/images/icon-warning-alert.png')} />
                <StyledText type="subtitle">Transaction Awaiting Signature</StyledText>
                <StyledText type="body">This transaction was created by an unknown address and is awaiting signature. Please carefully review all amounts and recipient addresses as transactions are not reversible. If you understand the risks and wish to continue, please add the sender (signer) to the address book whitelist. If the transaction looks suspicious, please block the sender.</StyledText>
            </View>
            <ButtonPlain title="Add to whitelist" onPress={() => Router.goToAddressBookEdit({address: signerAddress})}/>
        </>
    };

    return (!!viewId && 
        <Animated.View style={rootStyle}>
            <ScrollView>
                {/* notranslate */}
                {views[viewId]}
                {isLoading && <LoadingIndicator />}
            </ScrollView>
        </Animated.View>
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
        marginBottom: spacings.margin
    },
    icon: {
        width: 24,
        height: 24,
    },
    titleWarning: {
        color: colors.warning
    },
    titleDander: {
        color: colors.danger
    }
});
