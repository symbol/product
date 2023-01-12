import _ from 'lodash';
import React, { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { FlatList, RefreshControl, ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { AccountCard, Screen, TitleBar, FormItem, TabNavigator, StyledText, AccountAvatar, Widget } from 'src/components';
import { Router } from 'src/Router';
import store, { connect } from 'src/store';
import { borders, colors, spacings } from 'src/styles';
import { handleError, trunc, useDataManager, useInit } from 'src/utils';

export const Home = connect(state => ({
    addressBookWhiteList: state.addressBook.whiteList,
    balances: state.wallet.balances,
    currentAccount: state.account.current,
    ticker: state.network.ticker,
    isWalletReady: state.wallet.isReady,
}))(function Home(props) {
    const { addressBookWhiteList, balances, currentAccount, ticker, isWalletReady } = props;
    const [loadState, isLoading] = useDataManager(async () => {
        await store.dispatchAction({type: 'wallet/fetchAll'});
    }, null, handleError);
    useInit(loadState, isWalletReady);

    const accountBalance = currentAccount ? balances[currentAccount.address] : '-';
    const accountName = currentAccount?.name || '-';
    const accountAddress = currentAccount?.address || '-';

    return (
        <Screen 
            titleBar={<TitleBar accountSelector settings currentAccount={currentAccount} />}
            navigator={<TabNavigator />}
        >
            <ScrollView
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadState} />}
            >
                <FormItem>
                    <AccountCard 
                        name={accountName}
                        address={accountAddress}
                        balance={accountBalance}
                        ticker={ticker}
                        isActive
                        onReceivePress={() => {}}
                        onSendPress={Router.goToSend}
                        onDetailsPress={Router.goToAccountDetails}
                    />
                </FormItem>
                <FormItem type="group">
                    {/* notranslate */}
                    <StyledText type="title">Widgets</StyledText>
                    {/* notranslate */}
                    <Widget title="Address Book" onHeaderPress={Router.goToAddressBookList}>
                        <FlatList
                            horizontal
                            contentContainerStyle={styles.addressBookList}
                            data={addressBookWhiteList}
                            keyExtractor={(item, index) => 'contact' + index} 
                            renderItem={({item}) => (
                                <View style={styles.addressBookItem}>
                                    <AccountAvatar size="md" address={item.address}/>
                                    <StyledText type="body">{trunc(item.name, null, 12)}</StyledText>
                                </View>
                            )}
                            ListFooterComponent={
                                <TouchableOpacity style={styles.addressBookItem} onPress={Router.goToAddressBookAddContact}>
                                    <View style={styles.addressBookCircle}>
                                        <Image source={require('src/assets/images/icon-account-add.png')} style={styles.addressBookAddIcon} />
                                    </View>
                                    {/* notranslate */}
                                    <StyledText type="body">Add Contact</StyledText>
                                </TouchableOpacity>
                            } 
                        />
                    </Widget>
                </FormItem>
            </ScrollView>
        </Screen>
    );
});

const styles = StyleSheet.create({
    addressBookList: {
        padding: spacings.margin
    },
    addressBookItem: {
        width: 100,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
    },
    addressBookCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bgForm
    },
    addressBookAddIcon: {
        height: 24,
        width: 24
    },
})
