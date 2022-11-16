import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AccountCard, Button, Screen, TextBox, FormItem } from 'src/components';
import store, { connect } from 'src/store';

export const Home = connect(state => ({
    accountName: state.account.current.name,
    accountAddress: state.account.current.address,
    accountBalance: 123456.7899,
    ticker: 'XYM'
}))(function Home(props) {
    const { accountName, accountAddress, accountBalance, ticker } = props;

    useEffect(() => {
        const loadState = async () => {
            await store.dispatchAction({ type: 'wallet/loadState' });
            await store.dispatchAction({ type: 'account/loadState' });
        }

        loadState();
    }, []);

    return (
        <Screen>
            <FormItem>
                <AccountCard 
                    name={accountName}
                    address={accountAddress}
                    balance={accountBalance}
                    ticker={ticker}
                    onReceivePress={() => console.log('receive')}
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
