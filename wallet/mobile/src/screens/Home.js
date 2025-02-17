import React, { useCallback, useEffect, useMemo } from 'react';
import { ScrollView } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { AccountCardWidget, Alert, FormItem, Screen, StyledText, TabNavigator, TitleBar } from '@/app/components';
import { $t } from '@/app/localization';
import { Router } from '@/app/Router';
import { colors } from '@/app/styles';
import { handleError, useDataManager, useInit } from '@/app/utils';
import { AddressBookListWidget } from './AddressBookList';
import { HistoryWidget } from './History';
import WalletController from '@/app/lib/controller/MobileWalletController';
import { observer } from 'mobx-react-lite';
import { ControllerEventName, TransactionGroup } from '@/app/constants';

export const Home = observer(function Home() {
    const { isWalletReady, currentAccount, currentAccountInfo, networkIdentifier, ticker, price } = WalletController;
    const defaultUnconfirmedTransactions = useMemo(() => [], []);
    const [fetchUnconfirmedTransactions, isUnconfirmedTransactionsLoading, unconfirmedTransactions] = useDataManager(
        async () => {
            const transactions = await WalletController.fetchAccountTransactions({ group: TransactionGroup.UNCONFIRMED });
            return transactions.data;
        },
        defaultUnconfirmedTransactions,
        handleError
    );
    const [fetchPartialTransactions, isPartialTransactionsLoading, partialTransactions] = useDataManager(
        async () => {
            const transactions = await WalletController.fetchAccountTransactions({ group: TransactionGroup.PARTIAL });
            return transactions.data;
        },
        defaultUnconfirmedTransactions,
        handleError
    );
    const [renameAccount] = useDataManager(
        (name) =>
            WalletController.renameAccount({
                publicKey: currentAccount.publicKey,
                name,
                networkIdentifier,
            }),
        null,
        handleError
    );
    const loadState = useCallback(() => {
        WalletController.fetchAccountInfo();
        fetchUnconfirmedTransactions();
        fetchPartialTransactions();
    }, []);
    useInit(loadState, isWalletReady, [currentAccount]);

    useEffect(() => {
        WalletController.on(ControllerEventName.NEW_TRANSACTION_UNCONFIRMED, loadState);
        WalletController.on(ControllerEventName.NEW_TRANSACTION_CONFIRMED, loadState);

        return () => {
            WalletController.removeListener(ControllerEventName.NEW_TRANSACTION_UNCONFIRMED, loadState);
            WalletController.removeListener(ControllerEventName.NEW_TRANSACTION_CONFIRMED, loadState);
        };
    }, []);

    const accountBalance = currentAccountInfo.balance;
    const accountName = currentAccount?.name || '-';
    const accountAddress = currentAccount?.address || '-';

    const isLoading = isUnconfirmedTransactionsLoading || isPartialTransactionsLoading;
    return (
        <Screen titleBar={<TitleBar accountSelector settings currentAccount={currentAccount} />} navigator={<TabNavigator />}>
            <ScrollView refreshControl={<RefreshControl tintColor={colors.primary} refreshing={isLoading} onRefresh={loadState} />}>
                <Animated.View entering={FadeInUp}>
                    <FormItem>
                        <AccountCardWidget
                            name={accountName}
                            address={accountAddress}
                            balance={accountBalance}
                            ticker={ticker}
                            price={price}
                            networkIdentifier={networkIdentifier}
                            onReceivePress={Router.goToReceive}
                            onSendPress={Router.goToSend}
                            onDetailsPress={Router.goToAccountDetails}
                            onNameChange={renameAccount}
                        />
                    </FormItem>
                </Animated.View>
                {currentAccountInfo?.isMultisigAccount && (
                    <Animated.View entering={FadeInUp}>
                        <FormItem>
                            <Alert type="warning" title={$t('warning_multisig_title')} body={$t('warning_multisig_body')} />
                        </FormItem>
                    </Animated.View>
                )}
                <FormItem type="group" clear="bottom">
                    <StyledText type="title">{$t('s_home_widgets')}</StyledText>
                </FormItem>
                <HistoryWidget unconfirmed={unconfirmedTransactions} partial={partialTransactions} />
                <Animated.View entering={FadeInDown.delay(125)}>
                    <AddressBookListWidget />
                </Animated.View>
            </ScrollView>
        </Screen>
    );
});
