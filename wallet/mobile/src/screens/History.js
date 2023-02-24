import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { Filter, FormItem, ItemReceipt, ItemTransaction, ItemTransactionPlaceholder, Screen, StyledText, TabNavigator, TitleBar, Widget } from 'src/components';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import { HarvestingService } from 'src/services';
import store, { connect } from 'src/store';
import { colors, layout } from 'src/styles';
import { handleError, useDataManager, useInit } from 'src/utils';
import { TransactionType } from 'symbol-sdk';

export const History = connect((state) => ({
    isWalletReady: state.wallet.isReady,
    currentAccount: state.account.current,
    partial: state.transaction.partial,
    unconfirmed: state.transaction.unconfirmed,
    confirmed: state.transaction.confirmed,
    isLastPage: state.transaction.isLastPage,
    blackList: state.addressBook.blackList,
    networkProperties: state.network.networkProperties
}))(function History(props) {
    const { isWalletReady, isLastPage, currentAccount, partial, unconfirmed, confirmed, blackList, networkProperties } = props;
    const [harvested, setHarvested] = useState([]);
    const [pageNumber, setPageNumber] = useState(1);
    const [isNextPageRequested, setIsNextPageRequested] = useState(false);
    const [filter, setFilter] = useState({});
    const [fetchTransactions, isLoading] = useDataManager(
        async () => {
            setPageNumber(1);
            if (filter.harvested) {
                const harvestedPage = await HarvestingService.fetchHarvestedBlocks(networkProperties, currentAccount.address, { pageNumber: 1 });
                setHarvested(harvestedPage);
            }
            else {
                await store.dispatchAction({ type: 'transaction/fetchData', payload: {filter} });
            }
        },
        null,
        handleError
    );
    const [fetchNextPage, isPageLoading] = useDataManager(
        async () => {
            const nextPageNumber = pageNumber + 1;
            if (filter.harvested) {
                const harvestedPage = await HarvestingService.fetchHarvestedBlocks(networkProperties, currentAccount.address, { pageNumber: nextPageNumber });
                setHarvested(harvested => [...harvested, ...harvestedPage]);
            }
            else {
                await store.dispatchAction({ type: 'transaction/fetchPage', payload: { pageNumber: nextPageNumber, filter } });
            }
            setPageNumber(nextPageNumber);
        },
        null,
        handleError
    );
    useInit(fetchTransactions, isWalletReady, [currentAccount, blackList, filter]);

    const onEndReached = () => !isLastPage && setIsNextPageRequested(true);
    const isPlaceholderShown = (group) => group === 'confirmed' && !isLastPage;

    const isHarvestedShown = !!harvested.length && filter.harvested;
    const isPartialShown = !!partial?.length && !filter.harvested;
    const isUnconfirmedShown = !!unconfirmed?.length && !filter.harvested;
    const isConfirmedShown = !!confirmed?.length && !filter.harvested;
    const sections = [];

    if (isPartialShown) {
        sections.push({
            title: $t('transactionGroup_partial'),
            style: styles.titlePartial,
            group: 'partial',
            data: partial,
        });
    }
    if (isUnconfirmedShown) {
        sections.push({
            title: $t('transactionGroup_unconfirmed'),
            style: styles.titleUnconfirmed,
            group: 'unconfirmed',
            data: unconfirmed,
        });
    }
    if (isConfirmedShown) {
        sections.push({
            title: $t('transactionGroup_confirmed'),
            style: null,
            group: 'confirmed',
            data: confirmed,
        });
    }
    if (isHarvestedShown) {
        sections.push({
            title: $t('transactionGroup_harvested'),
            style: null,
            group: 'receipt',
            data: harvested,
        });
    }

    const filterConfig = [{
        name: 'type',
        title: $t('s_history_filter_type'),
        type: 'select',
        options: [
            {
                label: $t('transactionDescriptor_16724'),
                value: [TransactionType.TRANSFER]
            },
            {
                label: $t('transactionDescriptor_16961'),
                value: [TransactionType.AGGREGATE_BONDED]
            },
            {
                label: $t('transactionDescriptor_16705'),
                value: [TransactionType.AGGREGATE_COMPLETE]
            },
        ],
    }, {
        name: 'from',
        title: $t('s_history_filter_from'),
        type: 'address',
    }, {
        name: 'to',
        title: $t('s_history_filter_to'),
        type: 'address',
    }, {
        name: 'harvested',
        title: $t('s_history_filter_harvested'),
        type: 'boolean',
    }, {
        name: 'blocked',
        title: $t('s_history_filter_blocked'),
        type: 'boolean',
    },];

    useEffect(() => {
        if (!isLoading && !isPageLoading && isNextPageRequested) {
            fetchNextPage();
            setIsNextPageRequested(false);
        }
    }, [isLoading, isPageLoading, isNextPageRequested]);

    return (
        <Screen titleBar={<TitleBar accountSelector settings currentAccount={currentAccount} />} navigator={<TabNavigator />}>
            <SectionList
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchTransactions} />}
                onEndReached={onEndReached}
                onEndReachedThreshold={1}
                contentContainerStyle={styles.listContainer}
                sections={sections}
                ListEmptyComponent={!isLoading && (
                    <View style={styles.emptyList}> 
                        <StyledText type="label" style={styles.emptyListText}>{$t('message_emptyList')}</StyledText>
                    </View>
                )}
                ListHeaderComponent={<Filter data={filterConfig} isDisabled={isLoading} value={filter} onChange={setFilter} />}
                keyExtractor={(item, index) => index + (item.hash || item.id || item.height)}
                renderItem={({ item, section }) => (section.group === 'receipt' 
                    ? <ItemReceipt receipt={item} />
                    : <ItemTransaction
                        group={section.group}
                        transaction={item}
                        onPress={() => Router.goToTransactionDetails({ transaction: item })}
                    />
                )}
                renderSectionHeader={({ section: { title, style } }) => (
                    <FormItem>
                        <StyledText type="label" style={style}>
                            {title}
                        </StyledText>
                    </FormItem>
                )}
                renderSectionFooter={({ section: { group } }) => (
                    <FormItem style={styles.sectionFooter} clear="vertical">
                        {isPlaceholderShown(group) && (
                            <>
                                <ItemTransactionPlaceholder />
                                <ItemTransactionPlaceholder />
                                <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />
                            </>
                        )}
                    </FormItem>
                )}
            />
        </Screen>
    );
});

export const HistoryWidget = connect((state) => ({
    partial: state.transaction.partial,
    unconfirmed: state.transaction.unconfirmed,
}))(function HistoryWidget(props) {
    const { partial, unconfirmed } = props;
    const transactions = [
        ...partial.map((tx) => ({ ...tx, group: 'partial' })),
        ...unconfirmed.map((tx) => ({ ...tx, group: 'unconfirmed' })),
    ];
    const isWidgetShown = transactions.length > 0;

    return (
        isWidgetShown && (
            <Animated.View entering={FadeInDown.delay(125)} exiting={FadeOutUp}>
                <FormItem>
                    <Widget title={$t('s_history_widget_name')} onHeaderPress={() => Router.goToHistory()}>
                        {transactions.map((item) => (
                            <ItemTransaction
                                group={item.group}
                                transaction={item}
                                key={'tx' + item.hash || item.id}
                                onPress={() => Router.goToTransactionDetails({ transaction: item })}
                            />
                        ))}
                    </Widget>
                </FormItem>
            </Animated.View>
        )
    );
});

const styles = StyleSheet.create({
    listContainer: {
        flexGrow: 1
    },
    titlePartial: {
        color: colors.info,
    },
    titleUnconfirmed: {
        color: colors.warning,
    },
    loadingIndicator: {
        position: 'absolute',
        height: '100%',
        width: '100%',
    },
    sectionFooter: {
        position: 'relative',
    },
    emptyList: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center'
    },
    emptyListText: {
        textAlign: 'center',
        color: colors.bgMain,
    }
});
