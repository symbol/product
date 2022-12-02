import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { FlatList, TouchableOpacity } from 'react-native-gesture-handler';
import { AccountCard, Screen, FormItem, LoadingIndicator, Button } from 'src/components';
import store, { connect } from 'src/store';
import { usePromises } from 'src/utils';

export const AccountList = connect(state => ({
    currentAccount: state.account.current,
    accounts: state.wallet.accounts,
    balances: state.wallet.balances,
    networkIdentifier: state.network.networkIdentifier,
    ticker: state.network.ticker,
}))(function AccountList(props) {
    const { currentAccount, accounts, balances, networkIdentifier, ticker } = props;
    const [isLoading, setIsLoading] = useState(false);
    const [accountBalanceStateMap, setAccountBalanceStateMap] = usePromises({});
    const selectedPrivateKey = currentAccount?.privateKey || null;
    const networkAccounts = accounts[networkIdentifier];
    const navigation = useNavigation();
    
    const isAccountSelected = account => account.privateKey === selectedPrivateKey;

    const goToAddSeedAccount = () => navigation.navigate('AddSeedAccount');

    const selectAccount = async account => {
        setIsLoading(true);
        try {
            await store.dispatchAction({type: 'wallet/selectAccount', payload: account.privateKey});
            await store.dispatchAction({type: 'wallet/loadAll'});
            navigation.goBack();
        }
        catch(error) {
            showMessage({message: error.message, type: 'danger'});
        }
        setIsLoading(false);
    }

    useEffect(() => {
        const fetchBalances = async () => {
            const updatedAccountBalanceStateMap = {};
            for (const account of networkAccounts) {
                updatedAccountBalanceStateMap[account.address] = () => store.dispatchAction({type: 'wallet/fetchBalance', payload: account.address});
            }
            setAccountBalanceStateMap(updatedAccountBalanceStateMap);
        }
        fetchBalances();
    }, []);

    return (
        // notranslate
        <Screen bottomComponent={!isLoading && <Button title="Add Account" onPress={goToAddSeedAccount} />}>
            {isLoading && <LoadingIndicator />}
            <FlatList 
                style={styles.fill}
                data={networkAccounts} 
                keyExtractor={(item, index) => 'al' + item.name + index} 
                renderItem={({item, index}) => (
                <FormItem type="list">
                    <TouchableOpacity onPress={() => selectAccount(item)}>
                        <AccountCard
                            name={item.name}
                            address={item.address}
                            balance={balances[item.address]}
                            ticker={ticker}
                            isLoading={accountBalanceStateMap[item.address]}
                            isActive={isAccountSelected(item)}
                            isSimplified
                        />
                    </TouchableOpacity>
                </FormItem>
            )} />
        </Screen>
    );
});

const styles = StyleSheet.create({
    fill: {
        flex: 1
    }
});
