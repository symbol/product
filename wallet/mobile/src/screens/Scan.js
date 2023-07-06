import React, { useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
    AccountAvatar,
    Button,
    FormItem,
    ItemTransaction,
    QRScanner,
    Screen,
    StyledText,
    TabNavigator,
    TableView,
    TitleBar,
    Widget,
} from 'src/components';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import { connect } from 'src/store';
import { addressFromPrivateKey, addressFromPublicKey, getNativeMosaicAmount, networkTypeToIdentifier, useToggle } from 'src/utils';
import { layout } from 'src/styles';
import { TransactionType } from 'symbol-sdk';

const getQrAddress = (data) => {
    const networkIdentifier = networkTypeToIdentifier(data.networkType);
    if (data.accountPublicKey) {
        return addressFromPublicKey(data.accountPublicKey, networkIdentifier);
    }
    return addressFromPrivateKey(data.accountPrivateKey, networkIdentifier);
};
const getQrAmount = (data, networkProperties) => {
    return getNativeMosaicAmount(data.transaction.mosaics, networkProperties.networkCurrency.mosaicId);
};
const renderEmptyComponent = () => () => null;
const AccountCard = ({ address }) => (
    <FormItem>
        <Widget>
            <FormItem style={layout.alignCenter}>
                <AccountAvatar address={address} size="lg" />
            </FormItem>
            <FormItem>
                <TableView data={{ address }} rawAddresses />
            </FormItem>
        </Widget>
    </FormItem>
);
const TransactionCard = ({ recipientAddress, signerAddress, amount }) => (
    <ItemTransaction
        transaction={{
            recipientAddress,
            signerAddress,
            amount: -amount,
            type: TransactionType.TRANSFER,
            deadline: Date().toString(),
        }}
    />
);

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
    const [renderPreviewComponent, setRenderPreviewComponent] = useState(renderEmptyComponent);
    const [data, setData] = useState(null);
    const isFocused = useIsFocused();
    const options = {
        mnemonic: {
            description: $t('s_scan_mnemonic_description'),
            validate: () => true,
            renderComponent: renderEmptyComponent,
            actions: [],
        },
        account: {
            description: $t('s_scan_account_description'),
            invalidDescription: $t('s_scan_account_wrongNetwork_description'),
            validate: (data) => networkTypeToIdentifier(data.networkType) === networkIdentifier,
            renderComponent: (data) => <AccountCard address={getQrAddress(data)} />,
            actions: [
                {
                    title: $t('button_addToWallet'),
                    handler: (data) => Router.goToAddExternalAccount({ privateKey: data.accountPrivateKey }),
                },
                {
                    title: $t('button_addToAddressBook'),
                    handler: (data) => Router.goToAddressBookEdit({ address: getQrAddress(data) }),
                },
                {
                    title: $t('button_sendTransactionToThisAccount'),
                    handler: (data) => Router.goToSend({ recipientAddress: getQrAddress(data) }),
                },
            ],
        },
        contact: {
            description: $t('s_scan_address_description'),
            invalidDescription: $t('s_scan_address_wrongNetwork_description'),
            validate: (data) => networkTypeToIdentifier(data.networkType) === networkIdentifier,
            renderComponent: (data) => <AccountCard address={getQrAddress(data)} />,
            actions: [
                {
                    title: $t('button_addToAddressBook'),
                    handler: (data) => Router.goToAddressBookEdit({ address: getQrAddress(data) }),
                },
                {
                    title: $t('button_sendTransactionToThisAccount'),
                    handler: (data) => Router.goToSend({ recipientAddress: getQrAddress(data) }),
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
            renderComponent: (data) => (
                <TransactionCard
                    recipientAddress={data.transaction.recipientAddress}
                    amount={getQrAmount(data, networkProperties)}
                    signerAddress={currentAccount.address}
                />
            ),
            actions: [
                {
                    title: $t('button_sendTransferTransaction'),
                    handler: (data) =>
                        Router.goToSend({
                            recipientAddress: data.transaction.recipientAddress,
                            amount: getQrAmount(data, networkProperties),
                            message: data.transaction.message,
                        }),
                },
            ],
        },
    };

    const close = Router.goToHome;
    const clear = () => {
        setResponse(null);
        setDescription(null);
        setData(null);
        setRenderPreviewComponent(renderEmptyComponent);
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
            setRenderPreviewComponent(() => responseOption.renderComponent);
            setData(response.data);
        } else {
            setDescription(responseOption.invalidDescription);
            setActions([]);
            setRenderPreviewComponent(renderEmptyComponent);
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
        <Screen titleBar={<TitleBar accountSelector settings currentAccount={currentAccount} />} navigator={<TabNavigator />}>
            <FormItem>
                <StyledText type="title">{$t('s_scan_title')}</StyledText>
                <StyledText type="body">{description}</StyledText>
            </FormItem>
            {renderPreviewComponent(data)}
            <FormItem>
                {actions.map((action, index) => (
                    <FormItem type="list" key={'act' + index}>
                        <Button title={action.title} onPress={() => action.handler(data)} />
                    </FormItem>
                ))}
                <FormItem type="list">
                    <Button title={$t('button_scan')} onPress={toggleScanner} />
                </FormItem>
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
