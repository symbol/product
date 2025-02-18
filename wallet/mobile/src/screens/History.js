import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import {
    Filter,
    FormItem,
    ItemReceipt,
    ItemTransaction,
    ItemTransactionPlaceholder,
    Screen,
    StyledText,
    TabNavigator,
    TitleBar,
    Widget,
} from '@/app/components';
import { $t } from '@/app/localization';
import { Router } from '@/app/Router';
import { colors, spacings } from '@/app/styles';
import { filterAllowedTransactions, filterBlacklistedTransactions, handleError } from '@/app/utils';
import { useDataManager, useInit, useProp } from '@/app/hooks';
import { TransactionGroup, TransactionType } from '@/app/constants';
import WalletController from '@/app/lib/controller/MobileWalletController';
import { observer } from 'mobx-react-lite';
import { uniqBy } from 'lodash';

export const History = observer(function History() {
    const { isWalletReady, currentAccount, currentAccountLatestTransactions } = WalletController;
    const requestedAccountPublicKey = useRef(null);
    const blackList = useMemo(() => [], []);
    const [confirmed, setConfirmed] = useProp(currentAccountLatestTransactions);
    const [unconfirmed, setUnconfirmed] = useState([]);
    const [partial, setPartial] = useState([]);
    const [harvested, setHarvested] = useState([]);
    const [pageNumber, setPageNumber] = useState(1);
    const [isLastPage, setIsLastPage] = useState(false);
    const [isNextPageRequested, setIsNextPageRequested] = useState(false);
    const [filter, setFilter] = useState({});

    const fetchTransactions = async (pageNumber) => {
        const pageSize = 15;
        const confirmedSearchCriteria = {
            pageNumber,
            pageSize,
            group: TransactionGroup.CONFIRMED,
            filter,
        };

        // Always fetch confirmed transactions
        const confirmed = await WalletController.fetchAccountTransactions(confirmedSearchCriteria);

        // Filter transactions using address book
        const blackList = WalletController.modules.addressBook.blackList;
        const filteredConfirmed = filter.blocked
            ? filterBlacklistedTransactions(confirmed.data, blackList)
            : filterAllowedTransactions(confirmed.data, blackList);
        let filteredUnconfirmed;
        let filteredPartial;

        // Fetch unconfirmed and partial transactions only on the first page
        if (pageNumber === 1) {
            const unconfirmed = await WalletController.fetchAccountTransactions({ group: TransactionGroup.UNCONFIRMED });
            const partial = await WalletController.fetchAccountTransactions({ group: TransactionGroup.PARTIAL });

            // Filter transactions using address book
            filteredUnconfirmed = filter.blocked
                ? filterBlacklistedTransactions(unconfirmed.data, blackList)
                : filterAllowedTransactions(unconfirmed.data, blackList);
            filteredPartial = filter.blocked
                ? filterBlacklistedTransactions(partial.data, blackList)
                : filterAllowedTransactions(partial.data, blackList);
        }

        // Escape if account has changed
        if (requestedAccountPublicKey.current !== currentAccount.publicKey) return;

        // Update state
        if (pageNumber === 1) {
            setConfirmed(filteredConfirmed);
            setUnconfirmed(filteredUnconfirmed);
            setPartial(filteredPartial);
        } else {
            setConfirmed((previousConfirmed) => uniqBy([...previousConfirmed, ...filteredConfirmed], 'hash'));
        }

        const isLastPage = confirmed.data.length < pageSize;
        setIsLastPage(isLastPage);
        setPageNumber(pageNumber);
    };
    const fetchHarvestedBlocks = async (pageNumber) => {
        const harvestedPage = await WalletController.modules.harvesting.fetchAccountHarvestedBlocks({ pageNumber });

        if (requestedAccountPublicKey.current !== currentAccount.publicKey) return;

        setHarvested((harvested) => [...harvested, ...harvestedPage]);
        setPageNumber(pageNumber);
    };

    const [fetchInitialData, isLoading] = useDataManager(
        async () => {
            const pageNumber = 1;
            if (filter.harvested) await fetchHarvestedBlocks(pageNumber);
            else await fetchTransactions(pageNumber);
        },
        null,
        handleError
    );
    const [fetchNextPage, isPageLoading] = useDataManager(
        async (pageNumber) => {
            const nextPageNumber = pageNumber + 1;
            if (filter.harvested) await fetchHarvestedBlocks(nextPageNumber);
            else await fetchTransactions(nextPageNumber);
        },
        null,
        handleError
    );
    const refresh = () => {
        requestedAccountPublicKey.current = currentAccount.publicKey;
        setConfirmed(currentAccountLatestTransactions);
        setUnconfirmed([]);
        setPartial([]);
        setHarvested([]);
        setPageNumber(1);
        setIsLastPage(false);
        fetchInitialData();
    };
    useInit(refresh, isWalletReady, [currentAccount, blackList, filter]);

    const onEndReached = () => !isLastPage && setIsNextPageRequested(true);
    const isPlaceholderShown = (group) => group === TransactionGroup.CONFIRMED && !isLastPage;

    const isHarvestedShown = !!harvested.length && filter.harvested;
    const isPartialShown = !!partial?.length && !filter.harvested;
    const isUnconfirmedShown = !!unconfirmed?.length && !filter.harvested;
    const isConfirmedShown = !!confirmed?.length && !filter.harvested;
    const sections = [];

    if (isPartialShown) {
        sections.push({
            title: $t('transactionGroup_partial'),
            style: styles.titlePartial,
            group: TransactionGroup.PARTIAL,
            data: partial,
        });
    }
    if (isUnconfirmedShown) {
        sections.push({
            title: $t('transactionGroup_unconfirmed'),
            style: styles.titleUnconfirmed,
            group: TransactionGroup.UNCONFIRMED,
            data: unconfirmed,
        });
    }
    if (isConfirmedShown) {
        sections.push({
            title: $t('transactionGroup_confirmed'),
            style: null,
            group: TransactionGroup.CONFIRMED,
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

    const filterConfig = [
        {
            name: 'type',
            title: $t('s_history_filter_type'),
            type: 'select',
            options: [
                {
                    label: $t('transactionDescriptor_16724'),
                    value: [TransactionType.TRANSFER],
                },
                {
                    label: $t('transactionDescriptor_16961'),
                    value: [TransactionType.AGGREGATE_BONDED],
                },
                {
                    label: $t('transactionDescriptor_16705'),
                    value: [TransactionType.AGGREGATE_COMPLETE],
                },
            ],
        },
        {
            name: 'from',
            title: $t('s_history_filter_from'),
            type: 'address',
        },
        {
            name: 'to',
            title: $t('s_history_filter_to'),
            type: 'address',
        },
        {
            name: 'harvested',
            title: $t('s_history_filter_harvested'),
            type: 'boolean',
        },
        {
            name: 'blocked',
            title: $t('s_history_filter_blocked'),
            type: 'boolean',
        },
    ];

    useEffect(() => {
        if (!isLoading && !isPageLoading && isNextPageRequested) {
            fetchNextPage(pageNumber);
            setIsNextPageRequested(false);
        }
    }, [isLoading, isPageLoading, isNextPageRequested, pageNumber]);

    return (
        <Screen titleBar={<TitleBar accountSelector settings currentAccount={currentAccount} />} navigator={<TabNavigator />}>
            <SectionList
                key={currentAccount.publicKey}
                refreshControl={<RefreshControl tintColor={colors.primary} refreshing={isLoading} onRefresh={refresh} />}
                onEndReached={onEndReached}
                onEndReachedThreshold={1}
                stickySectionHeadersEnabled={false}
                contentContainerStyle={styles.listContainer}
                sections={sections}
                ListEmptyComponent={
                    !isLoading && (
                        <View style={styles.emptyList}>
                            <StyledText type="label" style={styles.emptyListText}>
                                {$t('message_emptyList')}
                            </StyledText>
                        </View>
                    )
                }
                ListHeaderComponent={<Filter data={filterConfig} isDisabled={isLoading} value={filter} onChange={setFilter} />}
                keyExtractor={(item, index) => index + (item.hash || item.id || item.height)}
                renderItem={({ item, section }) =>
                    section.group === 'receipt' ? (
                        <ItemReceipt receipt={item} />
                    ) : (
                        <ItemTransaction
                            group={section.group}
                            transaction={item}
                            onPress={() => Router.goToTransactionDetails({ transaction: item })}
                        />
                    )
                }
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
                                {isPageLoading && <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />}
                            </>
                        )}
                    </FormItem>
                )}
            />
        </Screen>
    );
});

export const HistoryWidget = (props) => {
    const { partial, unconfirmed } = props;
    const transactions = [
        ...partial.map((tx) => ({ ...tx, group: TransactionGroup.PARTIAL })),
        ...unconfirmed.map((tx) => ({ ...tx, group: TransactionGroup.UNCONFIRMED })),
    ];
    const isWidgetShown = transactions.length > 0;

    return (
        isWidgetShown && (
            <Animated.View entering={FadeInDown.delay(125)} exiting={FadeOutUp}>
                <FormItem>
                    <Widget title={$t('s_history_widget_name')} onHeaderPress={() => Router.goToHistory()}>
                        <View style={styles.widgetList}>
                            {transactions.map((item) => (
                                <ItemTransaction
                                    group={item.group}
                                    transaction={item}
                                    key={'tx' + item.hash || item.id}
                                    onPress={() => Router.goToTransactionDetails({ transaction: item })}
                                />
                            ))}
                        </View>
                    </Widget>
                </FormItem>
            </Animated.View>
        )
    );
};

const styles = StyleSheet.create({
    listContainer: {
        flexGrow: 1,
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
        alignItems: 'center',
    },
    emptyListText: {
        textAlign: 'center',
        color: colors.bgMain,
    },
    widgetList: {
        paddingTop: spacings.margin,
    },
});
