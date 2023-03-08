import React from 'react';
import { ScrollView } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { AccountCardWidget, Alert, FormItem, Screen, StyledText, TabNavigator, TitleBar } from 'src/components';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import store, { connect } from 'src/store';
import { colors } from 'src/styles';
import { handleError, useDataManager, useInit } from 'src/utils';
import { AddressBookListWidget } from './AddressBookList';
import { HistoryWidget } from './History';

export const Home = connect((state) => ({
    balances: state.wallet.balances,
    isMultisigAccount: state.account.isMultisig,
    currentAccount: state.account.current,
    networkIdentifier: state.network.networkIdentifier,
    ticker: state.network.ticker,
    isWalletReady: state.wallet.isReady,
}))(function Home(props) {
    const { balances, currentAccount, isMultisigAccount, networkIdentifier, ticker, isWalletReady } = props;
    const [loadState, isLoading] = useDataManager(
        async () => {
            await store.dispatchAction({ type: 'wallet/fetchAll' });
        },
        null,
        handleError
    );
    const [renameAccount] = useDataManager(
        async (name) => {
            await store.dispatchAction({
                type: 'wallet/renameAccount',
                payload: {
                    privateKey: currentAccount.privateKey,
                    networkIdentifier,
                    name,
                },
            });
            store.dispatchAction({ type: 'account/loadState' });
        },
        null,
        handleError
    );
    useInit(loadState, isWalletReady, [currentAccount]);

    const accountBalance = currentAccount ? balances[currentAccount.address] : '-';
    const accountName = currentAccount?.name || '-';
    const accountAddress = currentAccount?.address || '-';

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
                            onReceivePress={Router.goToReceive}
                            onSendPress={Router.goToSend}
                            onDetailsPress={Router.goToAccountDetails}
                            onNameChange={renameAccount}
                        />
                    </FormItem>
                </Animated.View>
                {isMultisigAccount && (
                    <Animated.View entering={FadeInUp}>
                        <FormItem>
                            <Alert type="warning" title={$t('warning_multisig_title')} body={$t('warning_multisig_body')} />
                        </FormItem>
                    </Animated.View>
                )}
                <FormItem type="group" clear="bottom">
                    <StyledText type="title">{$t('s_home_widgets')}</StyledText>
                </FormItem>
                <HistoryWidget />
                <Animated.View entering={FadeInDown.delay(125)}>
                    <AddressBookListWidget />
                </Animated.View>
            </ScrollView>
        </Screen>
    );
});
