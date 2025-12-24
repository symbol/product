import { Button, ButtonPlain, DialogBox, FormItem, Screen, TableView, Widget } from '@/app/components';
import { config } from '@/app/config';
import { useDataManager, usePasscode, useToggle } from '@/app/hooks';
import { controllers } from '@/app/lib/controller';
import { $t } from '@/app/localization';
import { Router } from '@/app/Router';
import { AccountCardWidget } from '@/app/screens/bridge/components/AccountCardWidget';
import { TokenItem } from '@/app/screens/bridge/components/TokenItem';
import { colors } from '@/app/styles';
import { createExplorerAccountUrl, handleError } from '@/app/utils';
import React, { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { RefreshControl, ScrollView } from 'react-native-gesture-handler';
import { constants } from 'wallet-common-core';

export const BridgeAccountDetails = props => {
    const { chainName } = props.route.params;
    const controller = controllers.additional.find(c => c.chainName === chainName);
    const { currentAccount, currentAccountInfo, networkIdentifier } = controller;
    const tokens = currentAccountInfo?.tokens || currentAccountInfo?.mosaics || [];

    // Refresh data
    const [loadData, isLoading] = useDataManager(
        controller.fetchAccountInfo,
        null,
        handleError
    );

    // Private key reveal
    const [privateKey, setPrivateKey] = useState('');
    const [isPrivateKeyDialogShown, togglePrivateKeyDialog] = useToggle(false);
    const revealPrivateKey = async () => {
        const privateKey = await controller.getCurrentAccountPrivateKey();
        setPrivateKey(privateKey);
        togglePrivateKeyDialog();
    };
    const confirmPrivateKeyReveal = usePasscode('enter', revealPrivateKey);

    // Remove account
    const [isRemoveConfirmVisible, toggleRemoveConfirm] = useToggle(false);
    const [removeAccount] = useDataManager(
        controller.clear,
        null,
        handleError
    );
    const handleConfirmRemove = () => {
        Router.goBack();
        removeAccount();
        toggleRemoveConfirm();
    };

    // Block explorer
    const openBlockExplorer = () => Linking.openURL(createExplorerAccountUrl(
        chainName, 
        networkIdentifier, 
        currentAccount.address
    ));

    useEffect(() => {
        controller.on(constants.ControllerEventName.NEW_TRANSACTION_CONFIRMED, loadData);
        
        return () => {
            controller.removeListener(constants.ControllerEventName.NEW_TRANSACTION_CONFIRMED, loadData);
        };
    }, []);

    return (
        <Screen
            bottomComponent={
                <>
                    <FormItem>
                        <ButtonPlain
                            icon={require('@/app/assets/images/icon-primary-explorer.png')}
                            title={$t('button_openTransactionInExplorer')}
                            onPress={openBlockExplorer}
                        />
                    </FormItem>
                    <FormItem>
                        <ButtonPlain
                            icon={require('@/app/assets/images/icon-primary-key.png')}
                            title={$t('button_revealPrivateKey')}
                            onPress={confirmPrivateKeyReveal}
                        />
                    </FormItem>
                    <FormItem>
                        <Button
                            variant="danger"
                            title={$t('button_removeAccount')}
                            onPress={toggleRemoveConfirm}
                        />
                    </FormItem>
                </>
            }
        >
            <ScrollView refreshControl={<RefreshControl tintColor={colors.primary} refreshing={isLoading} onRefresh={loadData} />}>
                <FormItem>
                    <AccountCardWidget
                        address={currentAccount.address}
                        chainName={chainName}
                        onSendPress={() => Router.goToSend({ chainName })}
                        onSwapPress={() => Router.goToBridgeSwap({ chainName })}
                    />
                </FormItem>

                {tokens.map(token => (
                    <TokenItem key={token.id} token={token} chainName={chainName} />
                ))}
            </ScrollView>
            <DialogBox
                type="alert"
                title={$t('dialog_sensitive')}
                body={<TableView data={{ privateKey }} />}
                isVisible={isPrivateKeyDialogShown}
                onSuccess={togglePrivateKeyDialog}
            />
            <DialogBox
                type="confirm"
                title={$t('dialog_removeAccount_title')}
                text={$t('dialog_removeAccount_body', { name: chainName, address: currentAccount.address })}
                isVisible={isRemoveConfirmVisible}
                onSuccess={handleConfirmRemove}
                onCancel={toggleRemoveConfirm}
            />
        </Screen>
    );
};
