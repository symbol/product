import React, { useEffect } from 'react';
import { RefreshControl, ScrollView } from 'react-native-gesture-handler';
import { AccountCard, Screen, TitleBar, FormItem, TabNavigator } from 'src/components';
import store, { connect } from 'src/store';
import { handleError, useDataManager } from 'src/utils';

export const Home = connect(state => ({
    balances: state.wallet.balances,
    currentAccount: state.account.current,
    ticker: state.network.ticker,
}))(function Home(props) {
    const { balances, currentAccount, ticker } = props;
    const [loadState, isLoading] = useDataManager(async () => {
        await store.dispatchAction({type: 'wallet/loadAll'});
    }, null, handleError);

    const accountBalance = currentAccount ? balances[currentAccount.address] : '-';
    const accountName = currentAccount?.name || '-';
    const accountAddress = currentAccount?.address || '-';

    useEffect(() => {
        loadState();
    }, []);

    return (
        <Screen 
            titleBar={<TitleBar accountSelector settings currentAccount={currentAccount} />}
            navigator={<TabNavigator />}
        >
            <ScrollView
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadState} />}
            >
                <FormItem>
                    <AccountCard 
                        name={accountName}
                        address={accountAddress}
                        balance={accountBalance}
                        ticker={ticker}
                        isActive
                        onReceivePress={loadState}
                        onSendPress={() => console.log('Send')}
                        onScanPress={() => console.log('Scan')}
                    />
                </FormItem>
            </ScrollView>
        </Screen>
    );
});
