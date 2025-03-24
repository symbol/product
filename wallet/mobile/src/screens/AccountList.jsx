import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo } from 'react';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { AccountCard, ButtonCircle, DialogBox, FormItem, Screen, TouchableNative } from '@/app/components';
import { handleError, toFixedNumber } from '@/app/utils';
import { useDataManager, usePromiseMap, useProp, useToggle } from '@/app/hooks';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, layout, timings } from '@/app/styles';
import { Router } from '@/app/Router';
import { $t } from '@/app/localization';
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import WalletController from '@/app/lib/controller/MobileWalletController';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { AccountService } from '@/app/lib/services';

export const AccountList = observer(function AccountList() {
    const { currentAccount, accounts, accountInfos, networkIdentifier, networkProperties, ticker } = WalletController;
    const [isRemoveConfirmVisible, toggleRemoveConfirm] = useToggle(false);
    const [accountToBeRemoved, setAccountToBeRemoved] = useState(null);
    const isPressed = useSharedValue(0);
    const [accountBalanceStateMap, fetchAccountBalances] = usePromiseMap();
    const selectedPublicKey = currentAccount?.publicKey || null;
    const networkAccounts = accounts[networkIdentifier];
    const [updatedNetworkAccounts, setUpdatedNetworkAccounts] = useProp(networkAccounts);
    const navigation = useNavigation();
    const accountBalances = useMemo(() => {
        const balances = {};
        networkAccounts.forEach((account) => {
            const isCached = !!accountInfos[networkIdentifier][account.publicKey]?.fetchedAt;
            const cachedBalance = isCached
                ? accountInfos[networkIdentifier][account.publicKey].balance
                : null;
            const isCurrentAvailable = accountBalanceStateMap[account.publicKey]?.status === 'fulfilled';
            const currentBalance = isCurrentAvailable
                ? accountBalanceStateMap[account.publicKey].value
                : null;

            let balanceChange = 0;
            if (isCached && isCurrentAvailable) {
                balanceChange = toFixedNumber(currentBalance - cachedBalance, networkProperties.networkCurrency.divisibility);
            }

            let balanceChangeText = '';
            if (balanceChange > 0) {
                balanceChangeText = `+${balanceChange}`;
            } else if (balanceChange < 0) {
                balanceChangeText = `${balanceChange}`;
            }

            const balanceText = isCurrentAvailable 
                ? currentBalance
                : isCached
                    ? cachedBalance
                    : '..';
            balances[account.publicKey] = {
                balanceText,
                balanceChangeText,
            };
        });

        return balances;
    }, [accountBalanceStateMap, accountInfos]);

    const animatedItem = useAnimatedStyle(() => ({
        transform: [
            {
                scale: interpolate(isPressed.value, [0, 1], [1, 0.9]),
            },
        ],
    }));

    const [selectAccount, isSelectAccountLoading] = useDataManager(
        async (account) => {
            await WalletController.selectAccount(account.publicKey);
            navigation.goBack();
        },
        null,
        handleError
    );
    const [saveAccounts] = useDataManager(
        async (data) => {
            await WalletController.changeAccountsOrder(networkIdentifier, data);
        },
        null,
        handleError
    );
    const [removeAccount] = useDataManager(
        async (account) => {
            if (account.publicKey === selectedPublicKey) {
                const rootAccount = networkAccounts[0];
                await WalletController.selectAccount(rootAccount.publicKey);
            }
            await WalletController.removeAccount({
                publicKey: account.publicKey,
                networkIdentifier,
            });
        },
        null,
        handleError
    );

    const isLoading = isSelectAccountLoading;

    const isAccountSelected = (account) => account.publicKey === selectedPublicKey;
    const handleLongPress = (drag) => {
        drag();
        handlePressIn();
    };
    const onDragEnd = ({ data }) => {
        setUpdatedNetworkAccounts(data);
        isPressed.value = 0;
        PlatformUtils.vibrate();
        saveAccounts(data);
    };
    const handlePressIn = () => {
        isPressed.value = withTiming(1, timings.press);
        PlatformUtils.vibrate();
    };
    const handlePressOut = () => {
        isPressed.value = withTiming(0, timings.press);
    };
    const handleRemovePress = (account) => {
        if (account.accountType === 'external') {
            setAccountToBeRemoved(account);
            toggleRemoveConfirm();
        } else {
            removeAccount(account);
        }
    };
    const handleConfirmRemove = () => {
        removeAccount(accountToBeRemoved);
        toggleRemoveConfirm();
    };

    const fetchBalances = async () => {
        const accountBalanceFetchMap = {};
        networkAccounts.forEach((account) => {
            accountBalanceFetchMap[account.publicKey] = AccountService.fetchAccountBalance(networkProperties, account.address);
        });
        fetchAccountBalances(accountBalanceFetchMap);
    };

    useEffect(() => {
        fetchBalances();
    }, [networkAccounts, accountInfos]);

    return (
        <Screen isLoading={isLoading}>
            <FormItem clear="vertical" fill>
                <DraggableFlatList
                    contentContainerStyle={layout.listContainer}
                    onDragEnd={onDragEnd}
                    containerStyle={layout.fill}
                    data={updatedNetworkAccounts}
                    keyExtractor={(item) => item.publicKey}
                    renderItem={({ item, drag, isActive }) => (
                        <FormItem type="list">
                            <TouchableNative
                                onPress={() => selectAccount(item)}
                                onLongPress={() => handleLongPress(drag)}
                                onPressOut={handlePressOut}
                                delayLongPress={250}
                                color={colors.bgGray}
                            >
                                <Animated.View style={isActive && animatedItem}>
                                    <AccountCard
                                        name={item.name}
                                        address={item.address}
                                        balance={accountBalances[item.publicKey].balanceText}
                                        balanceChange={accountBalances[item.publicKey].balanceChangeText}
                                        ticker={ticker}
                                        type={item.accountType}
                                        isLoading={!accountBalanceStateMap[item.publicKey]}
                                        isActive={isAccountSelected(item)}
                                        onRemove={item.index === 0 ? null : () => handleRemovePress(item)}
                                        isSimplified
                                    />
                                </Animated.View>
                            </TouchableNative>
                        </FormItem>
                    )}
                />
            </FormItem>
            <ButtonCircle source={require('@/app/assets/images/icon-dark-account-add.png')} onPress={() => Router.goToAddSeedAccount()} />
            <DialogBox
                type="confirm"
                title={$t('s_accountList_confirm_removeExternal_title')}
                text={$t('s_accountList_confirm_removeExternal_body', accountToBeRemoved)}
                isVisible={isRemoveConfirmVisible}
                onSuccess={handleConfirmRemove}
                onCancel={toggleRemoveConfirm}
            />
        </Screen>
    );
});
