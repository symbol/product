import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Vibration } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { FlatList, TouchableOpacity } from 'react-native-gesture-handler';
import DraggableFlatList from 'react-native-draggable-flatlist'
import { AccountCard, Screen, FormItem, LoadingIndicator, Button } from 'src/components';
import store, { connect } from 'src/store';
import { handleError, useDataManager, usePromises, useProp, vibrate } from 'src/utils';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { timings } from 'src/styles';
import { Router } from 'src/Router';

export const AccountList = connect(state => ({
    currentAccount: state.account.current,
    accounts: state.wallet.accounts,
    balances: state.wallet.balances,
    networkIdentifier: state.network.networkIdentifier,
    ticker: state.network.ticker,
}))(function AccountList(props) {
    const { currentAccount, accounts, balances, networkIdentifier, ticker } = props;
    const isPressed = useSharedValue(0);
    const [accountBalanceStateMap, setAccountBalanceStateMap] = usePromises({});
    const selectedPrivateKey = currentAccount?.privateKey || null;
    const networkAccounts = accounts[networkIdentifier];
    const [updatedNetworkAccounts, setUpdatedNetworkAccounts] = useProp(networkAccounts);
    const navigation = useNavigation();

    const animatedItem = useAnimatedStyle(() => ({
        transform: [{
            scale: interpolate(
                isPressed.value,
                [0, 1],
                [1, 0.9]
            ),
        }]
    }));

    const [selectAccount, isSelectAccountLoading] = useDataManager(async account => {
        await store.dispatchAction({type: 'wallet/selectAccount', payload: account.privateKey});
        await store.dispatchAction({type: 'wallet/loadAll'});
        navigation.goBack();
    }, null, handleError);
    const [saveAccounts] = useDataManager(async data => {
        await store.dispatchAction({type: 'wallet/saveAccounts', payload: { 
            accounts: data,
            networkIdentifier
        }});
    }, null, handleError);

    const isLoading = isSelectAccountLoading;

    const isAccountSelected = account => account.privateKey === selectedPrivateKey;
    const goToAddSeedAccount = Router.goToAddSeedAccount;
    const handleLongPress = drag => {
        drag();
        handlePressIn();
    }
    const onDragEnd = ({data}) => {
        setUpdatedNetworkAccounts(data);
        isPressed.value = 0;
        vibrate().short();
        saveAccounts(data);
    }
    const handlePressIn = () => {
        isPressed.value = withTiming(1, timings.press);
        vibrate().short();
    };
    const handlePressOut = () => {
        isPressed.value = withTiming(0, timings.press);
    };

    const fetchBalances = async () => {
        const updatedAccountBalanceStateMap = {};
        for (const account of networkAccounts) {
            updatedAccountBalanceStateMap[account.address] = () => store.dispatchAction({type: 'wallet/fetchBalance', payload: account.address});
        }
        setAccountBalanceStateMap(updatedAccountBalanceStateMap);
    }

    useEffect(() => {
        fetchBalances();
    }, []);

    return (
        // notranslate
        <Screen bottomComponent={!isLoading && <Button title="Add Account" onPress={goToAddSeedAccount} />}>
            {isLoading && <LoadingIndicator />}
            <DraggableFlatList 
                onDragEnd={onDragEnd}
                containerStyle={styles.fill}
                data={updatedNetworkAccounts} 
                keyExtractor={(item, index) => 'al' + item.name + index} 
                renderItem={({item, drag, isActive}) => (
                <FormItem type="list">
                    <TouchableOpacity 
                        onPress={() => selectAccount(item)} 
                        onLongPress={() => handleLongPress(drag)} 
                        onPressOut={handlePressOut}
                        delayLongPress={250}
                    >
                        <Animated.View style={isActive && animatedItem}>
                            <AccountCard
                                name={item.name}
                                address={item.address}
                                balance={balances[item.address]}
                                ticker={ticker}
                                isLoading={accountBalanceStateMap[item.address]}
                                isActive={isAccountSelected(item)}
                                isSimplified
                            />
                        </Animated.View>
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
