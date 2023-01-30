import _ from 'lodash';
import React from 'react';
import { RefreshControl, ScrollView } from 'react-native-gesture-handler';
import { AccountCardWidget, Alert, Screen, TitleBar, FormItem, TabNavigator, StyledText } from 'src/components';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import store, { connect } from 'src/store';
import { handleError, useDataManager, useInit } from 'src/utils';
import { AddressBookListWidget } from './AddressBookList';
import { HistoryWidget } from './History';

export const Home = connect(state => ({
    balances: state.wallet.balances,
    isMultisigAccount: state.account.isMultisig,
    currentAccount: state.account.current,
    networkIdentifier: state.network.networkIdentifier,
    ticker: state.network.ticker,
    isWalletReady: state.wallet.isReady,
}))(function Home(props) {
    const { balances, currentAccount, isMultisigAccount, networkIdentifier, ticker, isWalletReady } = props;
    const [loadState, isLoading] = useDataManager(async () => {
        await store.dispatchAction({type: 'wallet/fetchAll'});
    }, null, handleError);
    const [renameAccount] = useDataManager(async (name) => {
        await store.dispatchAction({type: 'wallet/renameAccount', payload: {
            privateKey: currentAccount.privateKey,
            networkIdentifier,
            name,
        }});
        store.dispatchAction({type: 'account/loadState'});
    }, null, handleError);
    useInit(loadState, isWalletReady, [currentAccount]);

    const accountBalance = currentAccount ? balances[currentAccount.address] : '-';
    const accountName = currentAccount?.name || '-';
    const accountAddress = currentAccount?.address || '-';

    return (
        <Screen 
            titleBar={<TitleBar accountSelector settings currentAccount={currentAccount} />}
            navigator={<TabNavigator />}
        >
            <ScrollView
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadState} />}
            >
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
                {isMultisigAccount && (
                    <FormItem>
                        <Alert 
                            type="warning" 
                            title={$t('warning_multisig_title')} 
                            body={$t('warning_multisig_body')}
                        />
                    </FormItem>
                )}
                <FormItem type="group" clear="bottom">
                    {/* notranslate */}
                    <StyledText type="title">Widgets</StyledText>
                </FormItem>
                <HistoryWidget />
                <AddressBookListWidget />
            </ScrollView>
        </Screen>
    );
});
