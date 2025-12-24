import { Router } from '@/app/Router';
import { AccountCard, ButtonCircle, DialogBox, FormItem, Screen, TouchableNative } from '@/app/components';
import { useDataManager, usePromiseMap, useProp, useToggle, useWalletController } from '@/app/hooks';
import { api } from '@/app/lib/api';
import { controllers } from '@/app/lib/controller';
import { $t } from '@/app/localization';
import { AccountCardItem } from '@/app/screens/bridge/components/AccountCardItem';
import { colors, layout, timings } from '@/app/styles';
import { handleError, toFixedNumber } from '@/app/utils';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';;
import { FlatList } from 'react-native-gesture-handler';

export const BridgeAccountList = () => {
    const accounts = useMemo(() => {
        return controllers.additional.map(controller => ({
            chainName: controller.chainName,
            account: controller.currentAccount,
            balance: controller.modules.bridge.sourceTokenBalance,
        }));
    }, controllers.additional.map(controller => controller.currentAccount));
    const [accountBalanceStateMap, fetchAccountBalances] = usePromiseMap();
    const accountBalances = useMemo(() => {
            const balances = {};
            accounts.forEach(a => {
                const { account } = a;

                if (!account) 
                    return;

                const isCurrentAvailable = accountBalanceStateMap[account.publicKey]?.status === 'fulfilled';
                const currentBalance = isCurrentAvailable
                    ? accountBalanceStateMap[account.publicKey].value
                    : null;
    
                balances[account.publicKey] = currentBalance;
            });
    
            return balances;
        }, [accountBalanceStateMap]);

    const fetchBalances = async () => {
        const accountBalanceFetchMap = {};
        controllers.additional.forEach(controller => {
            const account = controller.currentAccount;
            
            if (!account) 
                return;

            accountBalanceFetchMap[account.publicKey] = controller.fetchAccountInfo();
        });
        fetchAccountBalances(accountBalanceFetchMap);
    };

    const openAccount = (item) => {
        Router.goToBridgeAccountDetails({
            chainName: item.chainName,
        });
    };

    useEffect(() => {
        fetchBalances();
    }, [accounts]);

    return (
        <Screen>
            <FormItem clear="vertical" fill>
                <FlatList
                    contentContainerStyle={layout.listContainer}
                    containerStyle={layout.fill}
                    data={accounts}
                    keyExtractor={item => item.publicKey}
                    renderItem={({ item }) => (
                        <FormItem type="list">
                            <TouchableNative
                                onPress={() => openAccount(item)}
                                color={colors.bgGray}
                            >
                                <AccountCardItem
                                    chainName={item.chainName}
                                    account={item.account}
                                    // balance={accountBalances[item.account?.publicKey]?.balance}
                                    balance={item.balance}
                                    ticker={item.ticker}
                                    isLoading={false}
                                />
                            </TouchableNative>
                        </FormItem>
                    )}
                />
            </FormItem>
        </Screen>
    );
};
