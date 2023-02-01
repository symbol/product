import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import { Screen, TitleBar, TabNavigator, StyledText, ItemTransaction, ItemTransactionPlaceholder, FormItem, Widget } from 'src/components';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import store, { connect } from 'src/store';
import { colors, spacings } from 'src/styles';
import { handleError, useDataManager, useInit } from 'src/utils';

export const History = connect(state => ({
    isWalletReady: state.wallet.isReady,
    currentAccount: state.account.current,
    partial: state.transaction.partial,
    unconfirmed: state.transaction.unconfirmed,
    confirmed: state.transaction.confirmed,
    isLastPage: state.transaction.isLastPage,
    blackList: state.addressBook.blackList
}))(function History(props) {
    const { isWalletReady, isLastPage, currentAccount, partial, unconfirmed, confirmed, blackList } = props;
    const [pageNumber, setPageNumber] = useState(1);
    const [isNextPageRequested, setIsNextPageRequested] = useState(false);
    const [fetchTransactions, isLoading] = useDataManager(async () => {
        setPageNumber(1);
        await store.dispatchAction({type: 'transaction/fetchData'});
    }, null, handleError);
    const [fetchNextPage, isPageLoading] = useDataManager(async () => {
        const nextPageNumber = pageNumber + 1;
        await store.dispatchAction({type: 'transaction/fetchPage', payload: {pageNumber: nextPageNumber}});
        setPageNumber(nextPageNumber);
    }, null, handleError);
    useInit(fetchTransactions, isWalletReady, [currentAccount, blackList]);

    const onEndReached = () => !isLastPage && setIsNextPageRequested(true);
    const isPlaceholderShown = (group) => group === 'confirmed' && !isLastPage;
    const placeholderCount = 2;

    const isPartialShown = !!partial?.length;
    const isUnconfirmedShown = !!unconfirmed?.length;
    const isConfirmedShown = !!confirmed?.length;
    const sections = [];

    if (isPartialShown) {
        sections.push({
            title: $t('transactionGroup_partial'),
            style: styles.titlePartial,
            group: 'partial',
            data: partial
        });
    }
    if (isUnconfirmedShown) {
        sections.push({
            title: $t('transactionGroup_unconfirmed'),
            style: styles.titleUnconfirmed,
            group: 'unconfirmed',
            data: unconfirmed
        });
    }
    if (isConfirmedShown) {
        sections.push({
            title: $t('transactionGroup_confirmed'),
            style: null,
            group: 'confirmed',
            data: confirmed
        });
    }

    useEffect(() => {
        if (!isLoading && !isPageLoading && isNextPageRequested) {
            fetchNextPage();
            setIsNextPageRequested(false);
        }
    }, [isLoading, isPageLoading, isNextPageRequested])

    return (
        <Screen 
            titleBar={<TitleBar accountSelector settings currentAccount={currentAccount} />}
            navigator={<TabNavigator />}
        >
            <SectionList
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchTransactions} />}
                onEndReached={onEndReached}
                onEndReachedThreshold={1}
                sections={sections}
                keyExtractor={(item, index) => index + (item.hash || item.id)}
                renderItem={({item, section}) => (
                    <ItemTransaction group={section.group} transaction={item} onPress={() => Router.goToTransactionDetails({transaction: item})}/>
                )}
                renderSectionHeader={({ section: { title, style } }) => (
                    <FormItem>
                        <StyledText type="label" style={style}>{title}</StyledText>
                    </FormItem>
                )}
                renderSectionFooter={({ section: { group } }) => (
                    <FormItem style={styles.sectionFooter} clear="vertical">
                        {isPlaceholderShown(group) &&<>
                            {Array(placeholderCount).fill(null).map(() => <ItemTransactionPlaceholder />)}
                            <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />
                        </>}
                    </FormItem>
                )}
            />
        </Screen>
    );
});

export const HistoryWidget = connect(state => ({
    partial: state.transaction.partial,
    unconfirmed: state.transaction.unconfirmed,
}))(function HistoryWidget(props) {
    const { partial, unconfirmed } = props;
    const transactions = [
        ...partial.map(tx => ({...tx, group: 'partial'})), 
        ...unconfirmed.map(tx => ({...tx, group: 'unconfirmed'})),
    ];
    const isWidgetShown = transactions.length > 0;

    return (
        isWidgetShown &&
        <FormItem>
            <Widget title={$t('s_history_widget_name')} onHeaderPress={() => Router.goToHistory()}>
                {transactions.map(item => (
                    <ItemTransaction 
                        group={item.group} 
                        transaction={item} 
                        key={'tx' + item.hash || item.id}
                        onPress={() => Router.goToTransactionDetails({transaction: item})}
                    />
                ))}
            </Widget>
        </FormItem>
    )
});

const styles = StyleSheet.create({
    titlePartial: {
        color: colors.info
    },
    titleUnconfirmed: {
        color: colors.warning
    },
    loadingIndicator: {
        position: 'absolute',
        height: '100%',
        width: '100%'
    },
    sectionFooter: {
        position: 'relative',
    },
});
