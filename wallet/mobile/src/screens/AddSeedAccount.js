import React, { useEffect, useState } from 'react';
import { FlatList } from 'react-native-gesture-handler';
import { AccountCard, Screen, FormItem, StyledText, TextBox, TouchableNative, ButtonPlain } from 'src/components';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import store, { connect } from 'src/store';
import { colors } from 'src/styles';
import { handleError, useDataManager, usePromises, useValidation, validateAccountName } from 'src/utils';

export const AddSeedAccount = connect(state => ({
    accounts: state.wallet.accounts,
    seedAddresses: state.wallet.seedAddresses,
    balances: state.wallet.balances,
    networkIdentifier: state.network.networkIdentifier,
    ticker: state.network.ticker,
}))(function AddSeedAccount(props) {
    const { accounts, seedAddresses, balances, networkIdentifier, ticker } = props;
    const [accountName, setAccountName] = useState('');
    const nameErrorMessage = useValidation(accountName, [validateAccountName()], $t);
    const [accountBalanceStateMap, setAccountBalanceStateMap] = usePromises({});
    const networkAccounts = accounts[networkIdentifier];
    const networkSeedAddressed = seedAddresses[networkIdentifier];
    const networkSeedAccounts = networkSeedAddressed.map((address, index) => ({address, index}))
    const remainedSeedAccounts = networkSeedAccounts.filter(seedAccount => !networkAccounts.some(account => account.address === seedAccount.address));
    
    const getDefaultAccountName = index => $t('s_addAccount_seed_name_default', {index});
    const [addAccount, isAddAccountLoading] = useDataManager(async index => {
        const name = (!nameErrorMessage && accountName) || getDefaultAccountName(index);
        await store.dispatchAction({type: 'wallet/addSeedAccount', payload: { index, name, networkIdentifier }});
        await store.dispatchAction({type: 'wallet/loadAll'});
        await store.dispatchAction({type: 'account/fetchData'});
        Router.goBack();
    }, null, handleError);
    const [loadSeedAddresses, isSeedAddressesLoading] = useDataManager(async () => {
        await store.dispatchAction({type: 'wallet/generateSeedAddresses'});
    }, null, handleError);
    const fetchBalances = async () => {
        const updatedAccountBalanceStateMap = {};
        for (const account of remainedSeedAccounts) {
            updatedAccountBalanceStateMap[account.address] = () => store.dispatchAction({type: 'wallet/fetchBalance', payload: account.address});
        }
        setAccountBalanceStateMap(updatedAccountBalanceStateMap);
    }

    useEffect(() => {
        if (!networkSeedAccounts.length) {
            loadSeedAddresses();
        }
        fetchBalances();
    }, [networkSeedAddressed]);

    const isLoading = isAddAccountLoading || isSeedAddressesLoading;

    return (
        <Screen isLoading={isLoading}>
            <FormItem>
                <StyledText type="title">{$t('s_addAccount_name_title')}</StyledText>
                <TextBox title={$t('s_addAccount_name_input')} errorMessage={nameErrorMessage} value={accountName} onChange={setAccountName} />
            </FormItem>
            <FormItem>
                <StyledText type="body">{$t('s_addAccount_seed_description')}</StyledText>
                <ButtonPlain icon={require('src/assets/images/icon-primary-key.png')} title={$t('button_addExternalAccount')} onPress={() => Router.goToAddExternalAccount()} />
            </FormItem>
            <FormItem fill clear="bottom">
                <StyledText type="title">{$t('s_addAccount_select_title')}</StyledText>
                <FlatList 
                    data={remainedSeedAccounts}
                    keyExtractor={(_, index) => 'seed' + index} 
                    renderItem={({item}) => (
                    <FormItem type="list">
                        <TouchableNative onPress={() => addAccount(item.index)} color={colors.bgGray}>
                            <AccountCard
                                name={getDefaultAccountName(item.index)}
                                address={item.address}
                                balance={balances[item.address]}
                                ticker={ticker}
                                isLoading={accountBalanceStateMap[item.address]}
                                isActive={false}
                                isSimplified
                            />
                        </TouchableNative>
                    </FormItem>
                )} />
            </FormItem>
        </Screen>
    );
});
