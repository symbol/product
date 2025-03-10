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
} from '@/app/components';
import { $t } from '@/app/localization';
import { Router } from '@/app/Router';
import { useToggle } from '@/app/hooks';
import { layout } from '@/app/styles';
import { TransactionType } from '@/app/constants';
import { TransactionService } from '@/app/lib/services';
import WalletController from '@/app/lib/controller/MobileWalletController';
import { observer } from 'mobx-react-lite';

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
const TransactionCard = ({ recipientAddress, signerAddress, amount, price }) => (
    <ItemTransaction
        price={price}
        transaction={{
            recipientAddress,
            signerAddress,
            amount: -amount,
            type: TransactionType.TRANSFER,
            deadline: Date().toString(),
        }}
    />
);

export const Scan = observer(function Scan() {
    const { isWalletReady, currentAccount, networkIdentifier, networkProperties } = WalletController;
    const { price } = WalletController.modules.market;
    const [isScannerVisible, toggleScanner] = useToggle(true);
    const [response, setResponse] = useState(null);
    const [description, setDescription] = useState(null);
    const [actions, setActions] = useState([]);
    const [renderPreviewComponent, setRenderPreviewComponent] = useState(renderEmptyComponent);
    const [data, setData] = useState(null);
    const isFocused = useIsFocused();

    // Validators
    const validateNetwork = (data) => data.networkIdentifier === networkIdentifier;
    const validateTransactionTransfersOnlyNativeMosaic = (data) =>
        data.transaction.mosaics?.length === 1 && data.transaction.mosaics[0].id === networkProperties.networkCurrency.mosaicId;

    // Action buttons
    const createAddToAddressBookHandler = () => ({
        title: $t('button_addToAddressBook'),
        handler: (data) => Router.goToAddressBookEdit({ address: data.address }),
    });
    const createAddExternalAccountHandler = () => ({
        title: $t('button_addToWallet'),
        handler: (data) => Router.goToAddExternalAccount({ privateKey: data.accountPrivateKey }),
    });
    const createSendTransferToAddressHandler = () => ({
        title: $t('button_sendTransactionToThisAccount'),
        handler: (data) => Router.goToSend({ recipientAddress: data.address }),
    });
    const createSendTransactionHandler = () => ({
        title: $t('button_sendTransferTransaction'),
        handler: (data) =>
            Router.goToSend({
                recipientAddress: data.transaction.recipientAddress,
                amount: data.transaction.mosaics[0].amount,
                message: data.transaction.message,
            }),
    });

    // Scanned QR types handlers
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
            validate: validateNetwork,
            renderComponent: (data) => <AccountCard address={data.address} />,
            actions: [createAddExternalAccountHandler(), createAddToAddressBookHandler(), createSendTransferToAddressHandler()],
        },
        contact: {
            description: $t('s_scan_address_description'),
            invalidDescription: $t('s_scan_address_wrongNetwork_description'),
            validate: validateNetwork,
            renderComponent: (data) => <AccountCard address={data.address} />,
            actions: [createAddToAddressBookHandler(), createSendTransferToAddressHandler()],
        },
        address: {
            description: $t('s_scan_address_description'),
            invalidDescription: $t('s_scan_address_wrongNetwork_description'),
            validate: validateNetwork,
            renderComponent: (data) => <AccountCard address={data.address} />,
            actions: [createAddToAddressBookHandler(), createSendTransferToAddressHandler()],
        },
        transaction: {
            description: $t('s_scan_transaction_description'),
            invalidDescription: $t('s_scan_transaction_wrongTransaction_description'),
            format: async (data) => {
                // Convert transaction from payload and resolve it
                const transaction = await TransactionService.resolveTransactionFromPayload(
                    data.transactionPayload,
                    networkProperties,
                    currentAccount,
                );

                return { ...data, transaction };
            },
            validate: (data) => validateNetwork(data) && validateTransactionTransfersOnlyNativeMosaic(data),
            renderComponent: (data) => (
                <TransactionCard
                    recipientAddress={data.transaction.recipientAddress}
                    amount={data.transaction.mosaics[0].amount}
                    signerAddress={currentAccount.address}
                    price={price}
                />
            ),
            actions: [createSendTransactionHandler()],
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
    const processResponse = async (response) => {
        const responseOption = options[response.type];

        if (!responseOption) {
            clear();
        }

        const formattedData = responseOption.format ? await responseOption.format(response.data) : response.data;

        const isValid = responseOption.validate(formattedData);
        if (isValid) {
            setDescription(responseOption.description);
            setActions(responseOption.actions);
            setData(formattedData);
            setRenderPreviewComponent(() => responseOption.renderComponent);
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
            processResponse(response);
        }
    }, [isScannerVisible, response]);
    useEffect(() => {
        isFocused && clear();
    }, [isFocused]);

    return (
        <Screen
            titleBar={<TitleBar accountSelector settings currentAccount={currentAccount} />}
            navigator={<TabNavigator />}
            isLoading={!isWalletReady}
        >
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
