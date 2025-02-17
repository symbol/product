import React, { useEffect, useState } from 'react';
import { FlatList } from 'react-native-gesture-handler';
import { AccountCard, ButtonPlain, FormItem, Screen, StyledText, TextBox, TouchableNative } from '@/app/components';
import { $t } from '@/app/localization';
import { Router } from '@/app/Router';
import { colors } from '@/app/styles';
import { handleError, useDataManager, usePromises, useValidation, validateAccountName } from '@/app/utils';
import WalletController from '@/app/lib/controller/MobileWalletController';
import { observer } from 'mobx-react-lite';
import { WalletAccountType } from '@/app/constants';

export const AddSeedAccount = observer(function AddSeedAccount() {
    const { accounts, accountInfos, seedAddresses, networkIdentifier, ticker } = WalletController;
    const [accountName, setAccountName] = useState('');
    const nameErrorMessage = useValidation(accountName, [validateAccountName()], $t);
    const [accountBalanceStateMap, setAccountBalanceStateMap] = usePromises({});
    const networkAccounts = accounts[networkIdentifier];
    const networkSeedAccounts = seedAddresses[networkIdentifier];
    const remainedSeedAccounts = networkSeedAccounts.filter(
        (seedAccount) => !networkAccounts.some((account) => account.address === seedAccount.address)
    );

    const getDefaultAccountName = (index) => $t('s_addAccount_seed_name_default', { index });
    const [addAccount, isAddAccountLoading] = useDataManager(
        async (account) => {
            const name = (!nameErrorMessage && accountName) || getDefaultAccountName(account.index);
            await WalletController.addSeedAccount({
                accountType: WalletAccountType.SEED,
                name,
                networkIdentifier,
                index: account.index,
            });
            Router.goBack();
        },
        null,
        handleError
    );
    const fetchBalances = async () => {
        const updatedAccountBalanceStateMap = {};
        for (const account of networkSeedAccounts) {
            updatedAccountBalanceStateMap[account.publicKey] = () => WalletController.fetchAccountInfo(account.publicKey);
        }
        setAccountBalanceStateMap(updatedAccountBalanceStateMap);
    };

    useEffect(() => {
        fetchBalances();
    }, [networkSeedAccounts]);

    const isLoading = isAddAccountLoading;

    return (
        <Screen isLoading={isLoading}>
            <FormItem>
                <StyledText type="title">{$t('s_addAccount_name_title')}</StyledText>
                <TextBox
                    title={$t('s_addAccount_name_input')}
                    errorMessage={nameErrorMessage}
                    value={accountName}
                    onChange={setAccountName}
                />
            </FormItem>
            <FormItem>
                <StyledText type="body">{$t('s_addAccount_seed_description')}</StyledText>
                <ButtonPlain
                    icon={require('@/app/assets/images/icon-primary-key.png')}
                    title={$t('button_addExternalAccount')}
                    onPress={() => Router.goToAddExternalAccount()}
                />
            </FormItem>
            <FormItem fill clear="bottom">
                <StyledText type="title">{$t('s_addAccount_select_title')}</StyledText>
                <FlatList
                    data={remainedSeedAccounts}
                    keyExtractor={(item) => item.index}
                    renderItem={({ item }) => (
                        <FormItem type="list">
                            <TouchableNative onPress={() => addAccount(item)} color={colors.bgGray}>
                                <AccountCard
                                    name={getDefaultAccountName(item.index)}
                                    address={item.address}
                                    balance={accountInfos[networkIdentifier][item.publicKey]?.balance || 0}
                                    ticker={ticker}
                                    isLoading={accountBalanceStateMap[item.publicKey]}
                                    isActive={false}
                                    isSimplified
                                />
                            </TouchableNative>
                        </FormItem>
                    )}
                />
            </FormItem>
        </Screen>
    );
});
