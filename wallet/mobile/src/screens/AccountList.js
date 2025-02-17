import { useNavigation } from '@react-navigation/native';
import React, { useEffect } from 'react';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { AccountCard, ButtonCircle, DialogBox, FormItem, Screen, TouchableNative } from 'src/components';
import { handleError, useDataManager, usePromises, useProp, useToggle, vibrate } from 'src/utils';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, layout, timings } from 'src/styles';
import { Router } from 'src/Router';
import { $t } from 'src/localization';
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import WalletController from 'src/lib/controller/MobileWalletController';

export const AccountList = observer(function AccountList() {
    const { currentAccount, accounts, accountInfos, networkIdentifier, ticker } = WalletController;
    const [isRemoveConfirmVisible, toggleRemoveConfirm] = useToggle(false);
    const [accountToBeRemoved, setAccountToBeRemoved] = useState(null);
    const isPressed = useSharedValue(0);
    const [accountBalanceStateMap, setAccountBalanceStateMap] = usePromises({});
    const selectedPublicKey = currentAccount?.publicKey || null;
    const networkAccounts = accounts[networkIdentifier];
    const [updatedNetworkAccounts, setUpdatedNetworkAccounts] = useProp(networkAccounts);
    const navigation = useNavigation();

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
            await WalletController.removeAccount({
                publicKey: account.publicKey,
                networkIdentifier,
            });
            if (selectedPublicKey === account.publicKey) {
                await selectAccount(networkAccounts[0]);
            }
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
        vibrate().short();
        saveAccounts(data);
    };
    const handlePressIn = () => {
        isPressed.value = withTiming(1, timings.press);
        vibrate().short();
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
        const updatedAccountBalanceStateMap = {};
        for (const account of networkAccounts) {
            updatedAccountBalanceStateMap[account.publicKey] = () =>
                WalletController.fetchAccountInfo(account.publicKey);
        }
        setAccountBalanceStateMap(updatedAccountBalanceStateMap);
    };

    useEffect(() => {
        fetchBalances();
    }, []);

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
                                        balance={accountInfos[networkIdentifier][item.publicKey]?.balance || 0}
                                        ticker={ticker}
                                        type={item.accountType}
                                        isLoading={accountBalanceStateMap[item.publicKey]}
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
            <ButtonCircle source={require('src/assets/images/icon-dark-account-add.png')} onPress={() => Router.goToAddSeedAccount()} />
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
