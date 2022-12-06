import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { RefreshControl, ScrollView } from 'react-native-gesture-handler';
import { Screen, TitleBar, FormItem, TabNavigator, StyledText, ItemTransaction } from 'src/components';
import store, { connect } from 'src/store';
import { colors } from 'src/styles';
import { handleError, useDataManager, useInit } from 'src/utils';

export const History = connect(state => ({
    isWalletReady: state.wallet.isReady,
    currentAccount: state.account.current,
    partial: state.transaction.partial,
    unconfirmed: state.transaction.unconfirmed,
    confirmed: state.transaction.confirmed,
}))(function History(props) {
    const { isWalletReady, currentAccount, partial, unconfirmed, confirmed } = props;
    const [pageNumber, setPageNumber] = useState(0);
    const [fetchTransactions, isLoading] = useDataManager(async () => {
        setPageNumber(0);
        await store.dispatchAction({type: 'transaction/fetchData', payload: {pageNumber}});
    }, null, handleError);
    useInit(fetchTransactions, isWalletReady);

    const isPartialShown = !!partial?.length;
    const isUnconfirmedShown = !!unconfirmed?.length;
    const isConfirmedShown = !!confirmed?.length;

    return (
        <Screen 
            titleBar={<TitleBar accountSelector settings currentAccount={currentAccount} />}
            navigator={<TabNavigator />}
        >
            <ScrollView
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchTransactions} />}
            >
            {isPartialShown && (
                <FormItem>
                    {/* notranslate */}
                    <StyledText type="label" style={styles.titlePartial}>Awaiting Signature</StyledText>
                    {partial.map((transaction, index) => (
                        <ItemTransaction group="partial" transaction={transaction} key={'partial' + index}/>
                    ))}
                </FormItem>
            )}
            {isUnconfirmedShown && (
                <FormItem>
                    {/* notranslate */}
                    <StyledText type="label" style={styles.titleUnconfirmed}>Processing</StyledText>
                    {unconfirmed.map((transaction, index) => (
                        <ItemTransaction group="unconfirmed" transaction={transaction} key={'unconfirmed' + index}/>
                    ))}
                </FormItem>
            )}
            {isConfirmedShown && (
                <FormItem>
                    {/* notranslate */}
                    <StyledText type="label">Confirmed</StyledText>
                    {confirmed.map((transaction, index) => (
                        <ItemTransaction group="confirmed" transaction={transaction} key={'confirmed' + index}/>
                    ))}
                </FormItem>
            )}
            </ScrollView>
        </Screen>
    );
});
const styles = StyleSheet.create({
    titlePartial: {
        color: colors.info
    },
    titleUnconfirmed: {
        color: colors.warning
    },
});
