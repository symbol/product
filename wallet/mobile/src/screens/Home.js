import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { AccountCard, Button, Screen, TitleBar, FormItem } from 'src/components';
import store, { connect } from 'src/store';

export const Home = connect(state => ({
    accountBalance: 123456.7899,
    currentAccount: state.account.current,
    ticker: 'XYM'
}))(function Home(props) {
    const { accountBalance, currentAccount, ticker } = props;
    const [isLoading, setIsLoading] = useState(false);

    const accountName = currentAccount?.name || '-';
    const accountAddress = currentAccount?.address || '-';

    useEffect(() => {
        const loadState = async () => {
            setIsLoading(true);
            try {
                await store.dispatchAction({type: 'wallet/loadAll'});
            }
            catch(error) {
                showMessage({message: error.message, type: 'danger'});
            }
            setIsLoading(false);
        }

        loadState();
    }, []);

    return (
        <Screen titleBar={<TitleBar accountSelector settings currentAccount={currentAccount} />}>
            <FormItem>
                <AccountCard 
                    name={accountName}
                    address={accountAddress}
                    balance={accountBalance}
                    ticker={ticker}
                    isLoading={isLoading}
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
