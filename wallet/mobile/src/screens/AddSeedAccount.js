import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { FlatList, TouchableOpacity } from 'react-native-gesture-handler';
import { AccountCard, Screen, FormItem, LoadingIndicator, StyledText, TextBox } from 'src/components';
import store, { connect } from 'src/store';
import { usePromises, useValidation, validateAccountName } from 'src/utils';

export const AddSeedAccount = connect(state => ({
    accounts: state.wallet.accounts,
    seedAddresses: state.wallet.seedAddresses,
    balances: state.wallet.balances,
    networkIdentifier: state.network.networkIdentifier,
    ticker: state.network.ticker,
}))(function AddSeedAccount(props) {
    const { accounts, seedAddresses, balances, networkIdentifier, ticker } = props;
    const [isLoading, setIsLoading] = useState(false);
    const [accountName, setAccountName] = useState(false);
    const nameErrorMessage = useValidation(accountName, [validateAccountName()]);
    const [accountBalanceStateMap, setAccountBalanceStateMap] = usePromises({});
    const networkAccounts = accounts[networkIdentifier];
    const networkSeedAddressed = seedAddresses[networkIdentifier];
    const networkSeedAccounts = networkSeedAddressed.map((address, index) => ({address, index}))
    const remainedSeedAccounts = networkSeedAccounts.filter(seedAccount => !networkAccounts.some(account => account.address === seedAccount.address));
    const navigation = useNavigation();
    
    // notranslate
    const getDefaultAccountName = index => 'Seed ' + index;

    const addAccount = index => {
        setIsLoading(true);
        const name = (!nameErrorMessage && accountName) || getDefaultAccountName(index);
        setTimeout(async () => {
            try {
                await store.dispatchAction({type: 'wallet/addSeedAccount', payload: { index, name, networkIdentifier }});
                await store.dispatchAction({type: 'wallet/loadAll'});
                await store.dispatchAction({type: 'account/fetchData'});
                navigation.goBack();
            }
            catch(error) {
                showMessage({message: error.message, type: 'danger'});
            }
        });
    }

    useEffect(() => {
        const fetchBalances = async () => {
            const updatedAccountBalanceStateMap = {};
            for (const account of remainedSeedAccounts) {
                updatedAccountBalanceStateMap[account.address] = () => store.dispatchAction({type: 'wallet/fetchBalance', payload: account.address});
            }
            setAccountBalanceStateMap(updatedAccountBalanceStateMap);
        }
        const loadSeedAddresses = () => setTimeout(async () => {
            if (!networkSeedAccounts.length) {
                try {
                    await store.dispatchAction({type: 'wallet/generateSeedAddresses'});
                }
                catch(error) {
                    showMessage({message: error.message, type: 'danger'});
                }
            }
            setIsLoading(false);
        });

        setIsLoading(true);
        loadSeedAddresses();
        fetchBalances();
    }, [networkSeedAddressed]);

    return (
        <Screen>
            {isLoading && <LoadingIndicator />}
            <FormItem>
                {/* notranslate */}
                <StyledText type="title">Give a Name for New Account</StyledText>
                {/* notranslate */}
                <TextBox title="Name" errorMessage={nameErrorMessage} value={accountName} onChange={setAccountName} />
            </FormItem>
            <FormItem>
                {/* notranslate */}
                <StyledText type="title">Select Your Seed Account</StyledText>
            </FormItem>
            <FlatList 
                style={styles.fill}
                data={remainedSeedAccounts} 
                keyExtractor={(item, index) => 'seed' + index} 
                renderItem={({item}) => (
                <FormItem type="list">
                    <TouchableOpacity onPress={() => addAccount(item.index)}>
                        <AccountCard
                            name={getDefaultAccountName(item.index)}
                            address={item.address}
                            balance={balances[item.address]}
                            ticker={ticker}
                            isLoading={accountBalanceStateMap[item.address]}
                            isActive={false}
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
    },
});
