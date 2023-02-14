import React, { useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { Button, FormItem, QRScanner, Screen, StyledText, TabNavigator, TitleBar } from 'src/components';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import { connect } from 'src/store';
import { addressFromPrivateKey, addressFromPublicKey, getNativeMosaicAmount, networkTypeToIdentifier, useToggle } from 'src/utils';

export const Scan = connect((state) => ({
    balances: state.wallet.balances,
    isMultisigAccount: state.account.isMultisig,
    currentAccount: state.account.current,
    networkIdentifier: state.network.networkIdentifier,
    networkProperties: state.network.networkProperties,
    ticker: state.network.ticker,
    isWalletReady: state.wallet.isReady,
}))(function Scan(props) {
    const { currentAccount, networkIdentifier, networkProperties } = props;
    const [isScannerVisible, toggleScanner] = useToggle(true);
    const [response, setResponse] = useState(null);
    const [description, setDescription] = useState(null);
    const [actions, setActions] = useState([]);
    const [data, setData] = useState(null);
    const isFocused = useIsFocused();
    const options = {
        mnemonic: {
            description: $t('s_scan_mnemonic_description'),
            validate: () => true,
            actions: [],
        },
        account: {
            description: $t('s_scan_account_description'),
            invalidDescription: $t('s_scan_account_wrongNetwork_description'),
            validate: (data) => networkTypeToIdentifier(data.networkType) === networkIdentifier,
            actions: [
                {
                    title: $t('button_addToWallet'),
                    handler: (data) => Router.goToAddExternalAccount({ privateKey: data.accountPrivateKey }),
                },
                {
                    title: $t('button_addToAddressBook'),
                    handler: (data) => {
                        const networkIdentifier = networkTypeToIdentifier(data.networkType);
                        const address = addressFromPrivateKey(data.accountPrivateKey, networkIdentifier);
                        Router.goToAddressBookEdit({ address: address });
                    },
                },
                {
                    title: $t('button_sendTransactionToThisAccount'),
                    handler: (data) => {
                        const networkIdentifier = networkTypeToIdentifier(data.networkType);
                        const address = addressFromPrivateKey(data.accountPrivateKey, networkIdentifier);
                        Router.goToSend({ recipientAddress: address });
                    },
                },
            ],
        },
        contact: {
            description: $t('s_scan_address_description'),
            invalidDescription: $t('s_scan_address_wrongNetwork_description'),
            validate: (data) => networkTypeToIdentifier(data.networkType) === networkIdentifier,
            actions: [
                {
                    title: $t('button_addToAddressBook'),
                    handler: (data) => {
                        const networkIdentifier = networkTypeToIdentifier(data.networkType);
                        const address = addressFromPublicKey(data.accountPublicKey, networkIdentifier);
                        Router.goToAddressBookEdit({ address });
                    },
                },
                {
                    title: $t('button_sendTransactionToThisAccount'),
                    handler: (data) => {
                        const networkIdentifier = networkTypeToIdentifier(data.networkType);
                        const address = addressFromPublicKey(data.accountPublicKey, networkIdentifier);
                        Router.goToSend({ recipientAddress: address });
                    },
                },
            ],
        },
        transaction: {
            description: $t('s_scan_transaction_description'),
            invalidDescription: $t('s_scan_transaction_wrongTransaction_description'),
            validate: (data) =>
                networkTypeToIdentifier(data.networkType) === networkIdentifier &&
                data.transaction.mosaics?.length === 1 &&
                data.transaction.mosaics[0].id === networkProperties.networkCurrency.mosaicId,
            actions: [
                {
                    title: $t('button_sendTransferTransaction'),
                    handler: (data) => {
                        const amount = getNativeMosaicAmount(data.transaction.mosaics, networkProperties.networkCurrency.mosaicId);
                        Router.goToSend({
                            recipientAddress: data.transaction.recipientAddress,
                            amount: amount,
                            message: data.transaction.message,
                        });
                    },
                },
            ],
        },
    };

    const close = Router.goToHome;
    const clear = () => {
        setResponse(null);
        setDescription(null);
        setData(null);
        setActions([]);
    };
    const processResponse = () => {
        const responseOption = options[response.type];

        if (!responseOption) {
            clear();
        }

        const isValid = responseOption.validate(response.data);
        if (isValid) {
            setDescription(responseOption.description);
            setActions(responseOption.actions);
            setData(response.data);
        } else {
            setDescription(responseOption.invalidDescription);
            setActions([]);
            setData(null);
        }
    };

    useEffect(() => {
        if (!isScannerVisible && !response) {
            close();
            return;
        }

        if (response && options[response.type]) {
            processResponse();
        }
    }, [isScannerVisible, response]);
    useEffect(() => {
        isFocused && clear();
    }, [isFocused]);

    return (
        <Screen
            titleBar={<TitleBar accountSelector settings currentAccount={currentAccount} />}
            navigator={<TabNavigator />}
            bottomComponent={
                <FormItem>
                    <Button title={$t('button_scan')} onPress={toggleScanner} />
                </FormItem>
            }
        >
            <FormItem>
                <StyledText type="title">{$t('s_scan_title')}</StyledText>
                <StyledText type="body">{description}</StyledText>
            </FormItem>
            <FormItem>
                {actions.map((action, index) => (
                    <FormItem type="list" key={'act' + index}>
                        <Button title={action.title} onPress={() => action.handler(data)} />
                    </FormItem>
                ))}
            </FormItem>
            <QRScanner
                isVisible={isScannerVisible}
                networkProperties={networkProperties}
                onSuccess={(data, type) => setResponse({ data, type })}
                onClose={toggleScanner}
            />
        </Screen>
    );
});
