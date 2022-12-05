import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { AccountCard, Button, Screen, TitleBar, FormItem, TabNavigator } from 'src/components';
import store, { connect } from 'src/store';

export const Home = connect(state => ({
    balances: state.wallet.balances,
    currentAccount: state.account.current,
    ticker: state.network.ticker,
}))(function Home(props) {
    const { balances, currentAccount, ticker } = props;
    const [isLoading, setIsLoading] = useState(false);

    const accountBalance = currentAccount ? balances[currentAccount.address] : '-';
    const accountName = currentAccount?.name || '-';
    const accountAddress = currentAccount?.address || '-';

    const loadState = async () => {
        setIsLoading(true);
        try {
            await store.dispatchAction({type: 'wallet/loadAll'});
            await store.dispatchAction({type: 'network/fetchData'});
            await store.dispatchAction({type: 'account/fetchData'});
        }
        catch(error) {
            showMessage({message: error.message, type: 'danger'});
        }
        setIsLoading(false);
    }

    useEffect(() => {
        loadState();
    }, []);

    return (
        <Screen 
            titleBar={<TitleBar accountSelector settings currentAccount={currentAccount} />}
            navigator={<TabNavigator />}
        >
            <FormItem>
                <AccountCard 
                    name={accountName}
                    address={accountAddress}
                    balance={accountBalance}
                    ticker={ticker}
                    isLoading={isLoading}
                    isActive
                    onReceivePress={loadState}
                    onSendPress={() => console.log('Send')}
                    onScanPress={() => console.log('Scan')}
                />
            </FormItem>
        </Screen>
    );
});

const styles = StyleSheet.create({
    but: {
        height: 30,
        width: 30,
        backgroundColor: '#f005'
    }
});
