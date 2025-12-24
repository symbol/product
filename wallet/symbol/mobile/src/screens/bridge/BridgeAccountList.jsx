import { Router } from '@/app/Router';
import { AccountCard, ButtonCircle, DialogBox, FormItem, Screen, TouchableNative } from '@/app/components';
import { useDataManager, useWalletController, useWalletControllers } from '@/app/hooks';
import { controllers } from '@/app/lib/controller';
import { $t } from '@/app/localization';
import { AccountCardItem } from '@/app/screens/bridge/components/AccountCardItem';
import { useBridgeAccounts } from '@/app/screens/bridge/useBridgeAccounts';
import { colors, layout } from '@/app/styles';
import { handleError } from '@/app/utils';
import React, { useEffect } from 'react';;
import { FlatList, RefreshControl } from 'react-native-gesture-handler';

export const BridgeAccountList = () => {
    const mainWalletController = useWalletController();
    const { accounts, load } = useBridgeAccounts();

    const [activateAccount, isAccountActivating] = useDataManager(async (bridgeAccountController) => {
        const mnemonic = await mainWalletController.getMnemonic();
        await bridgeAccountController.saveMnemonicAndGenerateAccounts({
            mnemonic,
            name: 'Bridge Account',
            accountPerNetworkCount: 1
        });
        await bridgeAccountController.loadCache();
        await bridgeAccountController.selectNetwork(mainWalletController.networkIdentifier);
        await bridgeAccountController.connectToNetwork();
        await load();
    }, null, handleError);
    const openAccount = (item) => {
        Router.goToBridgeAccountDetails({
            chainName: item.chainName,
        });
    };

    useEffect(() => {
        load();
    }, [mainWalletController.networkIdentifier]);

    return (
        <Screen isLoading={isAccountActivating}>
            <FormItem clear="vertical" fill>
                <FlatList
                    contentContainerStyle={layout.listContainer}
                    containerStyle={layout.fill}
                    data={accounts}
                    keyExtractor={item => item.chainName}
                    renderItem={({ item }) => (
                        <FormItem type="list">
                            <TouchableNative
                                disabled={!item.isActivated}
                                onPress={() => openAccount(item)}
                                color={colors.bgGray}
                            >
                                <AccountCardItem
                                    chainName={item.chainName}
                                    isActivated={item.isActivated}
                                    address={item.account?.address}
                                    balance={item.sourceTokens[0]?.amount}
                                    ticker={item.sourceTokens[0]?.name}
                                    isLoading={item.isLoading}
                                    onActivatePress={() => activateAccount(item.controller)}
                                />
                            </TouchableNative>
                        </FormItem>
                    )}
                />
            </FormItem>
        </Screen>
    );
};
